import { getSupabaseClient, getSupabaseCredentials, listExistingSupabaseTables } from '../_lib/supabase.js';

function sendJson(res: any, status: number, data: any) {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(status).json(data);
  }
  res.statusCode = status;
  if (typeof res.setHeader === 'function') {
    res.setHeader('Content-Type', 'application/json');
  }
  return res.end(JSON.stringify(data));
}

async function handleEvents(req: any, res: any, queryParams: Record<string, string>) {
  try {
    const supabase = await getSupabaseClient();
    if (!supabase) {
      return sendJson(res, 200, {
        success: true,
        events: [],
        message: 'Supabase is not configured'
      });
    }

    const shiftStart = queryParams.shift_start;
    const shiftEnd = queryParams.shift_end;
    const afterId = queryParams.after_id;

    // Shift-bounded query: load all events within the operational shift boundaries
    if (shiftStart && shiftEnd) {
      const limit = Math.min(Math.max(parseInt(queryParams.limit || '500', 10) || 500, 1), 1000);

      let query = supabase
        .from('om_webhook_events')
        .select('id, event_type, account_id, platform_account_id, payload, received_at, event_timestamp')
        .gte('received_at', shiftStart)
        .lte('received_at', shiftEnd)
        .order('received_at', { ascending: false })
        .limit(limit);

      if (afterId) {
        const numAfterId = parseInt(afterId, 10);
        if (!isNaN(numAfterId)) {
          query = query.gt('id', numAfterId);
        } else {
          query = query.gt('id', afterId);
        }
      }

      const { data, error } = await query;

      if (error) {
        console.error('[Events History] Error fetching shift events from Supabase:', error);
        return sendJson(res, 200, {
          success: false,
          error: error.message,
          events: []
        });
      }

      const events = data || [];
      const truncated = events.length >= limit;

      return sendJson(res, 200, {
        success: true,
        events,
        truncated
      });
    }

    // Fallback: limit/after_id without shift bounds for backwards compatibility
    const limit = Math.min(Math.max(parseInt(queryParams.limit || '50', 10) || 50, 1), 100);

    let query = supabase
      .from('om_webhook_events')
      .select('id, event_type, account_id, platform_account_id, payload, received_at, event_timestamp')
      .order('received_at', { ascending: false })
      .limit(limit);

    if (afterId) {
      const numAfterId = parseInt(afterId, 10);
      if (!isNaN(numAfterId)) {
        query = query.gt('id', numAfterId);
      } else {
        query = query.gt('id', afterId);
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Events History] Error fetching from Supabase:', error);
      return sendJson(res, 200, {
        success: false,
        error: error.message,
        events: []
      });
    }

    return sendJson(res, 200, {
      success: true,
      events: data || []
    });
  } catch (err: any) {
    console.error('[Events History] Exception:', err);
    return sendJson(res, 200, {
      success: false,
      error: err.message || String(err),
      events: []
    });
  }
}

async function handleWebhooks(req: any, res: any) {
  try {
    const supabase = await getSupabaseClient();
    if (!supabase) {
      return sendJson(res, 200, {
        success: true,
        webhooks: [],
        message: 'Supabase is not configured'
      });
    }

    const { data, error } = await supabase
      .from('om_webhook_events')
      .select('*')
      .order('received_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('[Webhooks History] Error fetching from Supabase:', error);
      return sendJson(res, 200, {
        success: false,
        error: error.message,
        webhooks: []
      });
    }

    const webhooks = (data || []).map((row: any) => ({
      id: row.id,
      timestamp: row.received_at || row.event_timestamp,
      type: row.event_type,
      dedupKey: row.dedup_key,
      accountId: row.account_id,
      platformAccountId: row.platform_account_id,
      signatureValid: row.signature_valid,
      data: row.payload,
      source: 'OnlyMonster Webhook'
    }));

    return sendJson(res, 200, {
      success: true,
      webhooks
    });
  } catch (err: any) {
    console.error('[Webhooks History] Exception:', err);
    return sendJson(res, 200, {
      success: false,
      error: err.message || String(err),
      webhooks: []
    });
  }
}

async function handleLastActivity(req: any, res: any) {
  try {
    const supabase = await getSupabaseClient();
    if (!supabase) {
      return sendJson(res, 200, {
        success: true,
        lastOutgoingAtByAccount: {},
        message: 'Supabase is not configured'
      });
    }

    const { data, error } = await supabase
      .from('om_webhook_events')
      .select('account_id, platform_account_id, payload, event_timestamp, received_at')
      .eq('event_type', 'chat.message')
      .order('received_at', { ascending: false })
      .limit(500);

    if (error) {
      console.error('[LastActivity] Error fetching from Supabase:', error);
      return sendJson(res, 200, {
        success: false,
        error: error.message,
        lastOutgoingAtByAccount: {}
      });
    }

    const lastOutgoingMap: Record<string, number> = {};

    (data || []).forEach((row: any) => {
      const rawPayload = row.payload || {};
      const p = rawPayload.payload || rawPayload;
      const isIncoming = Boolean(
        (p.from_id && p.fan_id && String(p.from_id) === String(p.fan_id)) ||
        p.is_incoming === true ||
        p.direction === 'in' ||
        p.sender === 'fan'
      );

      if (!isIncoming) {
        const rawAccId = row.account_id || row.platform_account_id || p.account_id || p.platform_account_id || p.creator_id || p.model_id;
        if (rawAccId) {
          const accKey = String(rawAccId);
          const ts = new Date(row.event_timestamp || row.received_at || 0).getTime();
          if (ts > 0) {
            if (!lastOutgoingMap[accKey] || ts > lastOutgoingMap[accKey]) {
              lastOutgoingMap[accKey] = ts;
            }
          }
        }
      }
    });

    return sendJson(res, 200, {
      success: true,
      lastOutgoingAtByAccount: lastOutgoingMap
    });
  } catch (err: any) {
    console.error('[LastActivity] Exception:', err);
    return sendJson(res, 200, {
      success: false,
      error: err.message || String(err),
      lastOutgoingAtByAccount: {}
    });
  }
}

async function handleUnansweredCounts(req: any, res: any) {
  try {
    const supabase = await getSupabaseClient();
    if (!supabase) {
      return sendJson(res, 200, {
        success: true,
        unansweredCounts: {},
        message: 'Supabase is not configured'
      });
    }

    const { data, error } = await supabase
      .from('om_webhook_events')
      .select('account_id, platform_account_id, payload, event_timestamp, received_at')
      .eq('event_type', 'chat.message')
      .order('received_at', { ascending: false })
      .limit(1000);

    if (error) {
      console.error('[UnansweredCounts] Error fetching from Supabase:', error);
      return sendJson(res, 200, {
        success: false,
        error: error.message,
        unansweredCounts: {}
      });
    }

    // First find last outgoing timestamp per account
    const lastOutgoingMap: Record<string, number> = {};
    const eventsByAccount: Record<string, Array<{ isIncoming: boolean; ts: number }>> = {};

    (data || []).forEach((row: any) => {
      const rawPayload = row.payload || {};
      const p = rawPayload.payload || rawPayload;
      const rawAccId = row.account_id || row.platform_account_id || p.account_id || p.platform_account_id || p.creator_id || p.model_id;
      if (!rawAccId) return;

      const accKey = String(rawAccId);
      const ts = new Date(row.event_timestamp || row.received_at || 0).getTime();
      if (ts <= 0) return;

      const isIncoming = Boolean(
        (p.from_id && p.fan_id && String(p.from_id) === String(p.fan_id)) ||
        p.is_incoming === true ||
        p.direction === 'in' ||
        p.sender === 'fan'
      );

      if (!eventsByAccount[accKey]) {
        eventsByAccount[accKey] = [];
      }
      eventsByAccount[accKey].push({ isIncoming, ts });

      if (!isIncoming) {
        if (!lastOutgoingMap[accKey] || ts > lastOutgoingMap[accKey]) {
          lastOutgoingMap[accKey] = ts;
        }
      }
    });

    const unansweredCounts: Record<string, number> = {};
    const oldestUnansweredTsByAccount: Record<string, number> = {};

    Object.keys(eventsByAccount).forEach((accKey) => {
      const lastOutTs = lastOutgoingMap[accKey] || 0;
      const unanswered = eventsByAccount[accKey].filter(
        item => item.isIncoming && item.ts > lastOutTs
      );
      unansweredCounts[accKey] = unanswered.length;
      if (unanswered.length > 0) {
        const oldestTs = Math.min(...unanswered.map(u => u.ts));
        if (oldestTs > 0 && isFinite(oldestTs)) {
          oldestUnansweredTsByAccount[accKey] = oldestTs;
        }
      }
    });

    return sendJson(res, 200, {
      success: true,
      unansweredCounts,
      oldestUnansweredTsByAccount
    });
  } catch (err: any) {
    console.error('[UnansweredCounts] Exception:', err);
    return sendJson(res, 200, {
      success: false,
      error: err.message || String(err),
      unansweredCounts: {},
      oldestUnansweredTsByAccount: {}
    });
  }
}

async function handleLiveEvents(req: any, res: any, queryParams: Record<string, string>) {
  try {
    const supabase = await getSupabaseClient();
    if (!supabase) {
      return sendJson(res, 200, {
        success: true,
        events: [],
        message: 'Supabase is not configured'
      });
    }

    const nowIso = new Date().toISOString();
    const limit = Math.min(Math.max(parseInt(queryParams.limit || '100', 10) || 100, 1), 500);
    const category = queryParams.category;
    const status = queryParams.status;
    const shiftId = queryParams.shift_id;

    let query = supabase
      .from('om_live_events')
      .select('*')
      .gt('expires_at', nowIso)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (category && category !== 'all') {
      query = query.eq('category', category);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (shiftId) {
      query = query.eq('shift_id', shiftId);
    }

    const { data, error } = await query;

    if (error) {
      return sendJson(res, 200, {
        success: true,
        events: [],
        warning: error.message
      });
    }

    return sendJson(res, 200, {
      success: true,
      events: data || []
    });
  } catch (err: any) {
    console.error('[LiveEvents] Exception:', err);
    return sendJson(res, 200, {
      success: false,
      error: err.message || String(err),
      events: []
    });
  }
}

async function handleCleanupLiveEvents(req: any, res: any, queryParams: Record<string, string>) {
  try {
    const authHeader = req.headers?.authorization || req.headers?.Authorization;
    const cronSecret = process.env.CRON_SECRET || process.env.ADMIN_SECRET || 'om_cron_secret';
    const providedSecret = queryParams.secret || (authHeader ? authHeader.replace(/^Bearer\s+/i, '') : '');

    if (providedSecret !== cronSecret && process.env.NODE_ENV === 'production') {
      return sendJson(res, 401, { success: false, error: 'Unauthorized: Invalid cron secret' });
    }

    const supabase = await getSupabaseClient();
    if (!supabase) {
      return sendJson(res, 200, {
        success: false,
        message: 'Supabase is not configured'
      });
    }

    const nowIso = new Date().toISOString();
    const { error, count } = await supabase
      .from('om_live_events')
      .delete({ count: 'exact' })
      .lte('expires_at', nowIso);

    if (error) {
      return sendJson(res, 200, {
        success: false,
        error: error.message
      });
    }

    return sendJson(res, 200, {
      success: true,
      deleted_count: count ?? 0,
      cleaned_at: nowIso
    });
  } catch (err: any) {
    console.error('[CleanupLiveEvents] Exception:', err);
    return sendJson(res, 200, {
      success: false,
      error: err.message || String(err)
    });
  }
}

async function handleDbTables(req: any, res: any) {
  const creds = await getSupabaseCredentials();
  if (!creds) {
    return sendJson(res, 200, {
      success: false,
      configured: false,
      message: 'Supabase URL or Key not set on backend'
    });
  }

  const result = await listExistingSupabaseTables();
  return sendJson(res, 200, {
    success: result.success,
    configured: true,
    supabaseUrl: creds.url,
    tables: result.tables,
    error: result.error
  });
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return sendJson(res, 405, { success: false, error: 'Method not allowed' });
  }

  let queryParams: Record<string, string> = {};
  if (req.query && typeof req.query === 'object') {
    queryParams = req.query as Record<string, string>;
  } else if (req.url) {
    try {
      const parsedUrl = new URL(req.url, 'http://localhost');
      parsedUrl.searchParams.forEach((val, key) => {
        queryParams[key] = val;
      });
    } catch (e) {}
  }

  const resource = (queryParams.resource || 'webhooks').toLowerCase().trim();

  if (resource === 'events') {
    return handleEvents(req, res, queryParams);
  } else if (resource === 'live-events' || resource === 'live_events') {
    return handleLiveEvents(req, res, queryParams);
  } else if (resource === 'cleanup-live-events' || resource === 'cleanup_live_events') {
    return handleCleanupLiveEvents(req, res, queryParams);
  } else if (resource === 'last-activity' || resource === 'last_activity') {
    return handleLastActivity(req, res);
  } else if (resource === 'unanswered-counts' || resource === 'unanswered_counts') {
    return handleUnansweredCounts(req, res);
  } else if (resource === 'db-tables' || resource === 'tables') {
    return handleDbTables(req, res);
  } else {
    return handleWebhooks(req, res);
  }
}
