import { getSupabaseClient, getSupabaseCredentials, listExistingSupabaseTables } from '../_lib/supabase.js';
import { parseChatMessageDirection } from '../_lib/om-webhook-utils.js';

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

async function handleLastActivity(req: any, res: any, queryParams: Record<string, string> = {}) {
  try {
    const supabase = await getSupabaseClient();
    if (!supabase) {
      return sendJson(res, 200, {
        success: true,
        lastOutgoingAtByAccount: {},
        message: 'Supabase is not configured'
      });
    }

    const accountFilter = queryParams.account_id || queryParams.account || '';

    // Query last outgoing chat messages across full webhook history
    let query = supabase
      .from('om_webhook_events')
      .select('account_id, platform_account_id, payload, event_timestamp, received_at')
      .eq('event_type', 'chat.message')
      .order('received_at', { ascending: false })
      .limit(2000);

    if (accountFilter) {
      query = query.or(`account_id.eq.${accountFilter},platform_account_id.eq.${accountFilter}`);
    }

    const { data, error } = await query;

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
      const parsedDir = parseChatMessageDirection(row, row.platform_account_id);

      if (parsedDir.isOutgoing) {
        const rawAccIds = [
          row.account_id,
          row.platform_account_id,
          p.account_id,
          p.platform_account_id,
          p.creator_id,
          p.model_id,
          p.account?.id,
          p.account?.account_id,
          p.account?.platform_account_id,
          parsedDir.accountId,
          parsedDir.platformAccountId
        ].filter(Boolean);

        const tsStr = row.event_timestamp || row.received_at;
        const ts = tsStr ? new Date(tsStr).getTime() : 0;
        if (ts > 0) {
          rawAccIds.forEach(id => {
            const accKey = String(id).trim();
            if (accKey) {
              if (!lastOutgoingMap[accKey] || ts > lastOutgoingMap[accKey]) {
                lastOutgoingMap[accKey] = ts;
              }
            }
          });
        }
      }
    });

    // Cross-propagate max outgoing timestamp across all aliases in the same row
    (data || []).forEach((row: any) => {
      const rawPayload = row.payload || {};
      const p = rawPayload.payload || rawPayload;
      const parsedDir = parseChatMessageDirection(row, row.platform_account_id);
      const rawAccIds = [
        row.account_id,
        row.platform_account_id,
        p.account_id,
        p.platform_account_id,
        p.creator_id,
        p.model_id,
        p.account?.id,
        p.account?.account_id,
        p.account?.platform_account_id,
        parsedDir.accountId,
        parsedDir.platformAccountId
      ].filter(Boolean).map(id => String(id).trim()).filter(Boolean);

      let maxOut = 0;
      rawAccIds.forEach(id => {
        if (lastOutgoingMap[id] && lastOutgoingMap[id] > maxOut) {
          maxOut = lastOutgoingMap[id];
        }
      });
      if (maxOut > 0) {
        rawAccIds.forEach(id => {
          lastOutgoingMap[id] = Math.max(lastOutgoingMap[id] || 0, maxOut);
        });
      }
    });

    const specificTs = accountFilter ? (lastOutgoingMap[accountFilter] || 0) : undefined;

    return sendJson(res, 200, {
      success: true,
      ...(accountFilter ? {
        account_id: accountFilter,
        last_outgoing_at: specificTs || null,
        last_outgoing_iso: specificTs ? new Date(specificTs).toISOString() : null,
        elapsed_minutes: specificTs ? Math.floor((Date.now() - specificTs) / 60000) : null
      } : {}),
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

    // First find last outgoing timestamp across all aliases per account
    const lastOutgoingMap: Record<string, number> = {};
    const eventsByAccount: Record<string, Array<{ isIncoming: boolean; ts: number }>> = {};

    (data || []).forEach((row: any) => {
      const rawPayload = row.payload || {};
      const p = rawPayload.payload || rawPayload;
      const parsedDir = parseChatMessageDirection(row, row.platform_account_id);
      
      const rawAccIds = [
        row.account_id,
        row.platform_account_id,
        p.account_id,
        p.platform_account_id,
        p.creator_id,
        p.model_id,
        p.account?.id,
        p.account?.account_id,
        p.account?.platform_account_id,
        parsedDir.accountId,
        parsedDir.platformAccountId
      ].filter(Boolean).map(id => String(id).trim()).filter(Boolean);

      if (rawAccIds.length === 0) return;

      const ts = new Date(row.event_timestamp || row.received_at || 0).getTime();
      if (ts <= 0) return;

      rawAccIds.forEach(accKey => {
        if (!eventsByAccount[accKey]) {
          eventsByAccount[accKey] = [];
        }
        eventsByAccount[accKey].push({ isIncoming: parsedDir.isIncoming, ts });

        if (parsedDir.isOutgoing) {
          if (!lastOutgoingMap[accKey] || ts > lastOutgoingMap[accKey]) {
            lastOutgoingMap[accKey] = ts;
          }
        }
      });
    });

    // Cross-propagate max outgoing timestamp across all aliases in the same row
    (data || []).forEach((row: any) => {
      const rawPayload = row.payload || {};
      const p = rawPayload.payload || rawPayload;
      const parsedDir = parseChatMessageDirection(row, row.platform_account_id);
      const rawAccIds = [
        row.account_id,
        row.platform_account_id,
        p.account_id,
        p.platform_account_id,
        p.creator_id,
        p.model_id,
        p.account?.id,
        p.account?.account_id,
        p.account?.platform_account_id,
        parsedDir.accountId,
        parsedDir.platformAccountId
      ].filter(Boolean).map(id => String(id).trim()).filter(Boolean);

      let maxOut = 0;
      rawAccIds.forEach(id => {
        if (lastOutgoingMap[id] && lastOutgoingMap[id] > maxOut) {
          maxOut = lastOutgoingMap[id];
        }
      });
      if (maxOut > 0) {
        rawAccIds.forEach(id => {
          lastOutgoingMap[id] = Math.max(lastOutgoingMap[id] || 0, maxOut);
        });
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

async function handleRawDiagnostic(req: any, res: any, queryParams: Record<string, string>) {
  try {
    const supabase = await getSupabaseClient();
    if (!supabase) {
      return sendJson(res, 200, {
        success: false,
        message: 'Supabase is not configured'
      });
    }

    const accountFilter = queryParams.account_id || queryParams.account || '';
    const limit = Math.min(Math.max(parseInt(queryParams.limit || '20', 10) || 20, 1), 100);

    let query = supabase
      .from('om_webhook_events')
      .select('id, event_type, account_id, platform_account_id, payload, event_timestamp, received_at')
      .eq('event_type', 'chat.message')
      .order('received_at', { ascending: false })
      .limit(limit);

    if (accountFilter) {
      query = query.or(`account_id.eq.${accountFilter},platform_account_id.eq.${accountFilter}`);
    }

    const { data, error } = await query;
    if (error) {
      return sendJson(res, 200, { success: false, error: error.message });
    }

    const rows = (data || []).map((r: any) => {
      const p = r.payload?.payload || r.payload || {};
      const msg = p.message || {};
      const acc = p.account || {};

      const from_id = msg.from_id ?? p.from_id ?? null;
      const fan_id = msg.fan_id ?? p.fan_id ?? null;
      const payload_platform_account_id = acc.platform_account_id ?? p.platform_account_id ?? null;

      const old_isIncoming = Boolean(
        (p.from_id && p.fan_id && String(p.from_id) === String(p.fan_id)) ||
        p.is_incoming === true ||
        p.direction === 'in' ||
        p.sender === 'fan'
      );
      const old_isOutgoing = !old_isIncoming;

      const parsed = parseChatMessageDirection(r, r.platform_account_id);

      return {
        id: r.id,
        event_type: r.event_type,
        account_id: r.account_id,
        platform_account_id: r.platform_account_id,
        from_id,
        fan_id,
        payload_platform_account_id,
        event_timestamp: r.event_timestamp,
        received_at: r.received_at,
        old_isOutgoing,
        new_isOutgoing: parsed.isOutgoing,
        new_isIncoming: parsed.isIncoming,
        text: msg.text || p.text || ''
      };
    });

    return sendJson(res, 200, {
      success: true,
      count: rows.length,
      rows
    });
  } catch (err: any) {
    return sendJson(res, 200, { success: false, error: err.message || String(err) });
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
  } else if (resource === 'raw-diagnostic' || resource === 'raw-events' || resource === 'raw_events') {
    return handleRawDiagnostic(req, res, queryParams);
  } else if (resource === 'live-events' || resource === 'live_events') {
    return handleLiveEvents(req, res, queryParams);
  } else if (resource === 'cleanup-live-events' || resource === 'cleanup_live_events') {
    return handleCleanupLiveEvents(req, res, queryParams);
  } else if (resource === 'last-activity' || resource === 'last_activity') {
    return handleLastActivity(req, res, queryParams);
  } else if (resource === 'unanswered-counts' || resource === 'unanswered_counts') {
    return handleUnansweredCounts(req, res);
  } else if (resource === 'db-tables' || resource === 'tables') {
    return handleDbTables(req, res);
  } else {
    return handleWebhooks(req, res);
  }
}
