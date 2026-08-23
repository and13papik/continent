import { getSupabaseClient, getSupabaseCredentials, listExistingSupabaseTables } from '../_lib/supabase.js';
import { parseChatMessageDirection, classifyChatMessage } from '../_lib/om-webhook-utils.js';

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

export function normalizeTimestampMs(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;

  if (typeof val === 'number') {
    if (isNaN(val) || !isFinite(val) || val <= 0) return null;
    // Unix timestamp in seconds (e.g. 1755850530, < 100 billion)
    if (val < 100000000000) {
      return Math.floor(val * 1000);
    }
    return Math.floor(val);
  }

  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;

    // Numeric timestamp as string
    if (/^\d+$/.test(trimmed)) {
      const num = Number(trimmed);
      if (isNaN(num) || num <= 0) return null;
      if (num < 100000000000) {
        return Math.floor(num * 1000);
      }
      return Math.floor(num);
    }

    // Standard date / ISO string
    const parsed = new Date(trimmed).getTime();
    if (!isNaN(parsed) && isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  if (val instanceof Date) {
    const t = val.getTime();
    return (!isNaN(t) && isFinite(t) && t > 0) ? t : null;
  }

  return null;
}

async function handleLastActivity(req: any, res: any, queryParams: Record<string, string> = {}) {
  // Temporarily paused querying om_webhook_events to prevent database overload/504 errors
  return sendJson(res, 200, {
    success: true,
    lastOutgoingAtByAccount: {},
    message: "last-activity background querying is temporarily paused for database stability"
  });
}

async function handleUnansweredCounts(req: any, res: any) {
  // Temporarily paused querying om_webhook_events to prevent database overload/504 errors
  return sendJson(res, 200, {
    success: true,
    unansweredCounts: {},
    oldestUnansweredTsByAccount: {},
    message: "unanswered-counts background querying is temporarily paused for database stability"
  });
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

// In-memory fallback/cache for live events
const serverLiveEventsStore = new Map<string, any>();

export async function purgeExpiredLiveEvents(): Promise<{ deleted_count: number; cleaned_at: string }> {
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();
  let count = 0;

  // Clean in-memory store
  for (const [key, ev] of serverLiveEventsStore.entries()) {
    const expMs = new Date(ev.expires_at || 0).getTime();
    if (expMs <= nowMs) {
      serverLiveEventsStore.delete(key);
      count++;
    }
  }

  try {
    const supabase = await getSupabaseClient();
    if (supabase) {
      let { error, count: dbCount } = await supabase
        .from('live_events')
        .delete({ count: 'exact' })
        .lte('expires_at', nowIso);

      if (error && error.message?.includes('does not exist')) {
        const fb = await supabase
          .from('om_live_events')
          .delete({ count: 'exact' })
          .lte('expires_at', nowIso);
        dbCount = fb.count;
      }
      count = Math.max(count, dbCount || 0);
    }
  } catch (e) {
    console.error('[purgeExpiredLiveEvents] DB cleanup error:', e);
  }

  return { deleted_count: count, cleaned_at: nowIso };
}

async function handleLiveEvents(req: any, res: any, queryParams: Record<string, string>) {
  try {
    const supabase = await getSupabaseClient();
    const nowIso = new Date().toISOString();
    const nowMs = Date.now();

    // POST: Insert or upsert milestone live events
    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) { body = {}; }
      }
      const rawEvents = Array.isArray(body?.events) ? body.events : (body ? [body] : []);
      if (rawEvents.length === 0) {
        return sendJson(res, 400, { success: false, error: 'No events provided in request body' });
      }

      const rowsToInsert = rawEvents.map((ev: any) => {
        const expiresIso = ev.expires_at || new Date(Date.now() + 24 * 3600 * 1000).toISOString();
        const row = {
          dedupe_key: String(ev.dedupe_key || ''),
          event_type: ev.event_type || 'account_shift_revenue_milestone',
          category: ev.category || 'finance',
          account_id: ev.account_id ? String(ev.account_id) : null,
          account_name: ev.account_name || null,
          shift_id: String(ev.shift_id || ''),
          milestone: Number(ev.milestone || 0),
          amount: ev.amount !== undefined && ev.amount !== null ? Number(ev.amount) : null,
          currency: ev.currency || 'USD',
          title: ev.title || '',
          description: ev.description || '',
          status: ev.status || 'active',
          created_at: ev.created_at || nowIso,
          updated_at: ev.updated_at || nowIso,
          expires_at: expiresIso,
        };

        if (row.dedupe_key) {
          serverLiveEventsStore.set(row.dedupe_key, row);
        }
        return row;
      });

      if (supabase) {
        try {
          let insertRes = await supabase
            .from('live_events')
            .upsert(rowsToInsert, { onConflict: 'dedupe_key', ignoreDuplicates: false });

          if (insertRes.error && insertRes.error.message?.includes('does not exist')) {
            insertRes = await supabase
              .from('om_live_events')
              .upsert(rowsToInsert, { onConflict: 'dedupe_key', ignoreDuplicates: false });
          }

          if (insertRes.error) {
            console.error('[LiveEvents] Upsert error into DB:', insertRes.error);
          }
        } catch (dbErr) {
          console.error('[LiveEvents] DB upsert exception:', dbErr);
        }
      }

      return sendJson(res, 200, {
        success: true,
        inserted_count: rowsToInsert.length
      });
    }

    // GET: Query unexpired financial milestone events
    const limit = Math.min(Math.max(parseInt(queryParams.limit || '100', 10) || 100, 1), 500);
    const shiftId = queryParams.shift_id;

    const eventsMap = new Map<string, any>();

    // First, populate from in-memory server store
    for (const [key, ev] of serverLiveEventsStore.entries()) {
      const expMs = new Date(ev.expires_at || 0).getTime();
      if (expMs > nowMs) {
        if (!shiftId || ev.shift_id === shiftId) {
          eventsMap.set(key, ev);
        }
      } else {
        serverLiveEventsStore.delete(key);
      }
    }

    // If Supabase is available, query unexpired events and merge
    if (supabase) {
      try {
        let query = supabase
          .from('live_events')
          .select('*')
          .gt('expires_at', nowIso)
          .eq('event_type', 'account_shift_revenue_milestone')
          .order('created_at', { ascending: false })
          .limit(limit);

        if (shiftId) {
          query = query.eq('shift_id', shiftId);
        }

        let { data, error } = await query;

        if (error && error.message?.includes('does not exist')) {
          let fallbackQuery = supabase
            .from('om_live_events')
            .select('*')
            .gt('expires_at', nowIso)
            .eq('event_type', 'account_shift_revenue_milestone')
            .order('created_at', { ascending: false })
            .limit(limit);

          if (shiftId) {
            fallbackQuery = fallbackQuery.eq('shift_id', shiftId);
          }

          const fbResult = await fallbackQuery;
          data = fbResult.data;
          error = fbResult.error;
        }

        if (!error && Array.isArray(data)) {
          data.forEach((row: any) => {
            if (row.dedupe_key) {
              eventsMap.set(row.dedupe_key, row);
              serverLiveEventsStore.set(row.dedupe_key, row);
            }
          });
        }
      } catch (dbQueryErr) {
        console.error('[LiveEvents] DB query exception:', dbQueryErr);
      }
    }

    const mergedEvents = Array.from(eventsMap.values()).slice(0, limit);

    return sendJson(res, 200, {
      success: true,
      events: mergedEvents
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

    const result = await purgeExpiredLiveEvents();
    return sendJson(res, 200, {
      success: true,
      deleted_count: result.deleted_count,
      cleaned_at: result.cleaned_at
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
