import { requireSession } from '../_lib/auth.js';
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

export function formatEvents(rows: any[], isCompact: boolean = true) {
  return rows.map((r: any) => {
    // Enforce string preservation for 64-bit integer (bigint) safety.
    // When querying PostgREST with 'id:id::text', the ID arrives from PostgreSQL as a string,
    // avoiding IEEE 754 precision loss that occurs when JSON.parse parses numbers > Number.MAX_SAFE_INTEGER.
    let strId: string | null = null;
    if (r.id !== undefined && r.id !== null) {
      if (typeof r.id === 'number' && !Number.isSafeInteger(r.id)) {
        throw new Error(
          `Unsafe bigint ID: event ID ${r.id} is an unsafe JavaScript number exceeding Number.MAX_SAFE_INTEGER. ` +
          `Precision has been compromised. ID must be queried as string ('id:id::text') from database to prevent cursor corruption.`
        );
      }
      strId = String(r.id).trim();
    }
    if (!isCompact) {
      return { ...r, id: strId };
    }
    const rawP = r.payload?.payload || r.payload || {};
    return {
      id: strId,
      event_type: r.event_type,
      account_id: r.account_id,
      platform_account_id: r.platform_account_id,
      received_at: r.received_at,
      event_timestamp: r.event_timestamp,
      dedup_key: r.dedup_key,
      payload: {
        price_gross: rawP.price_gross ?? rawP.amount_gross ?? rawP.amount ?? rawP.price ?? 0,
        amount_gross: rawP.amount_gross ?? null,
        amount: rawP.amount ?? null,
        price: rawP.price ?? null,
        account_id: rawP.account_id ?? null,
        platform_account_id: rawP.platform_account_id ?? null,
        creator_id: rawP.creator_id ?? null,
      }
    };
  });
}

export async function handleEvents(req: any, res: any, queryParams: Record<string, string>) {
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
    // Item 1: Harmonize after_id and since_id for backwards & forwards compatibility
    const rawAfterId = queryParams.after_id || queryParams.since_id || '';
    const afterId = typeof rawAfterId === 'string' ? rawAfterId.trim() : String(rawAfterId || '');
    const isCompact = queryParams.compact === '1' || queryParams.compact === 'true';



    // Cast id to text via PostgREST column casting syntax 'id:id::text' so that PostgREST transmits
    // the 64-bit bigint as a JSON string, guaranteeing that client/server JSON.parse does NOT convert
    // it to a JavaScript Number and corrupt values exceeding Number.MAX_SAFE_INTEGER (9007199254740991).
    const selectFields = 'id:id::text, event_type, account_id, platform_account_id, payload, received_at, event_timestamp, dedup_key';
    const fallbackSelectFields = 'id, event_type, account_id, platform_account_id, payload, received_at, event_timestamp, dedup_key';

    // Shift-bounded query: load all events within the operational shift boundaries
    if (shiftStart && shiftEnd) {
      const limit = Math.min(Math.max(parseInt(queryParams.limit || '500', 10) || 500, 1), 1000);
      const isAsc = queryParams.order === 'asc' || (Boolean(afterId) && queryParams.order !== 'desc');

      let query = supabase
        .from('om_webhook_events')
        .select(selectFields)
        .gte('received_at', shiftStart)
        .lte('received_at', shiftEnd)
        .order(isAsc ? 'id' : 'received_at', { ascending: isAsc })
        .limit(limit);

      if (afterId) {
        // Schema Note: om_webhook_events.id is a monotonically increasing 64-bit integer (bigint).
        // Passing the string representation directly to PostgREST preserves exact 64-bit precision.
        // NOTE: Random UUIDs are NOT supported with `id > cursor` because non-monotonic UUIDs
        // cause events with lexicographically smaller IDs to be missed.
        query = query.gt('id', afterId);
      }

      let { data, error } = await query;

      // Graceful fallback if a mock Supabase or specific PostgREST version doesn't support column casting syntax
      if (error && (error.message?.includes('id::text') || error.message?.includes('syntax') || error.message?.includes('failed to parse'))) {
        let fallbackQuery = supabase
          .from('om_webhook_events')
          .select(fallbackSelectFields)
          .gte('received_at', shiftStart)
          .lte('received_at', shiftEnd)
          .order(isAsc ? 'id' : 'received_at', { ascending: isAsc })
          .limit(limit);
        if (afterId) {
          fallbackQuery = fallbackQuery.gt('id', afterId);
        }
        const fallbackRes = await fallbackQuery;
        data = fallbackRes.data;
        error = fallbackRes.error;
      }

      if (error) {
        console.error('[Events History] Error fetching shift events from Supabase:', error);
        return sendJson(res, 200, {
          success: false,
          error: error.message,
          events: []
        });
      }

      const rawEvents = data || [];
      const events = formatEvents(rawEvents, isCompact);
      const truncated = rawEvents.length >= limit;

      return sendJson(res, 200, {
        success: true,
        events,
        truncated
      });
    }

    // Fallback: limit/after_id without shift bounds
    const limit = Math.min(Math.max(parseInt(queryParams.limit || '50', 10) || 50, 1), 100);
    // When polling with after_id/since_id, sort ascending chronologically so no events are skipped when > limit arrive
    const isAsc = queryParams.order === 'asc' || Boolean(afterId);

    let query = supabase
      .from('om_webhook_events')
      .select(selectFields)
      .order(isAsc ? 'id' : 'received_at', { ascending: isAsc })
      .limit(limit);

    if (afterId) {
      query = query.gt('id', afterId);
    }

    let { data, error } = await query;

    if (error && (error.message?.includes('id::text') || error.message?.includes('syntax') || error.message?.includes('failed to parse'))) {
      let fallbackQuery = supabase
        .from('om_webhook_events')
        .select(fallbackSelectFields)
        .order(isAsc ? 'id' : 'received_at', { ascending: isAsc })
        .limit(limit);
      if (afterId) {
        fallbackQuery = fallbackQuery.gt('id', afterId);
      }
      const fallbackRes = await fallbackQuery;
      data = fallbackRes.data;
      error = fallbackRes.error;
    }

    if (error) {
      console.error('[Events History] Error fetching from Supabase:', error);
      return sendJson(res, 200, {
        success: false,
        error: error.message,
        events: []
      });
    }

    const rawData = data || [];
    const formattedData = formatEvents(rawData, isCompact);

    return sendJson(res, 200, {
      success: true,
      events: formattedData,
      truncated: rawData.length >= limit
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

async function handleWebhooks(req: any, res: any, queryParams: Record<string, string> = {}) {
  try {
    const supabase = await getSupabaseClient();
    if (!supabase) {
      return sendJson(res, 200, {
        success: true,
        webhooks: [],
        message: 'Supabase is not configured'
      });
    }

    const singleId = queryParams.id || queryParams.webhook_id;
    if (singleId) {
      // Detailed single webhook view by ID (loads full payload on demand)
      // Passing singleId directly as string to PostgREST preserves bigint/string precision
      const query = supabase
        .from('om_webhook_events')
        .select('id, received_at, event_timestamp, event_type, dedup_key, account_id, platform_account_id, signature_valid, payload')
        .eq('id', singleId);

      const { data, error } = await query.single();
      if (error) {
        return sendJson(res, 200, {
          success: false,
          error: error.message
        });
      }

      return sendJson(res, 200, {
        success: true,
        webhook: {
          id: data.id,
          timestamp: data.received_at || data.event_timestamp,
          type: data.event_type,
          dedupKey: data.dedup_key,
          accountId: data.account_id,
          platformAccountId: data.platform_account_id,
          signatureValid: data.signature_valid,
          data: data.payload,
          payload: data.payload,
          source: 'OnlyMonster Webhook'
        }
      });
    }

    // List view: select lightweight summary without full JSON blob to save network bandwidth and memory
    const { data, error } = await supabase
      .from('om_webhook_events')
      .select('id, received_at, event_timestamp, event_type, dedup_key, account_id, platform_account_id, signature_valid')
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
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'Use POST for cleanup' });
    if (!await requireSession(req, res, true)) return;

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
  if (!await requireSession(req, res, false)) return;
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

  let resource = (queryParams.resource || '').toLowerCase().trim();
  if (!resource) {
    const rawPath = (req.path || req.url || '').split('?')[0];
    if (rawPath.endsWith('/events')) resource = 'events';
    else if (rawPath.endsWith('/live-events')) resource = 'live-events';
    else if (rawPath.endsWith('/webhooks')) resource = 'webhooks';
    else if (rawPath.endsWith('/db-tables')) resource = 'db-tables';
    else resource = 'webhooks';
  }

  if (resource === 'events') {
    return handleEvents(req, res, queryParams);
  } else if (resource === 'raw-diagnostic' || resource === 'raw-events' || resource === 'raw_events') {
    if (!await requireSession(req, res, true)) return;
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
    if (!await requireSession(req, res, true)) return;
    return handleDbTables(req, res);
  } else {
    return handleWebhooks(req, res, queryParams);
  }
}
