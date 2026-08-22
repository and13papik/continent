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
    const accountsParam = queryParams.accounts || '';
    const requestedAccountIds = [
      ...accountFilter.split(','),
      ...accountsParam.split(',')
    ].map(s => s.trim()).filter(Boolean);

    // 1. First fetch latest batch of chat messages across history (large window)
    let query = supabase
      .from('om_webhook_events')
      .select('account_id, platform_account_id, payload, event_timestamp, received_at')
      .eq('event_type', 'chat.message')
      .order('received_at', { ascending: false })
      .limit(5000);

    if (accountFilter && requestedAccountIds.length === 1) {
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

    const allRows: any[] = [...(data || [])];
    const lastOutgoingMap: Record<string, number> = {};

    const ingestRow = (row: any) => {
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

        const rawTs = p.message?.created_at ||
          p.message?.timestamp ||
          p.created_at ||
          p.timestamp ||
          row.event_timestamp ||
          row.received_at;

        const ts = normalizeTimestampMs(rawTs);
        if (ts && ts > 0) {
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
    };

    allRows.forEach(ingestRow);

    // 2. Targeted fallback for any explicitly requested accounts not found in top batch
    const missingAccounts = requestedAccountIds.filter(id => !lastOutgoingMap[id]);
    if (missingAccounts.length > 0) {
      const uniqueMissing = Array.from(new Set(missingAccounts)).slice(0, 30);
      await Promise.all(
        uniqueMissing.map(async (accId) => {
          try {
            const { data: targetedData } = await supabase
              .from('om_webhook_events')
              .select('account_id, platform_account_id, payload, event_timestamp, received_at')
              .eq('event_type', 'chat.message')
              .or(`account_id.eq.${accId},platform_account_id.eq.${accId}`)
              .order('received_at', { ascending: false })
              .limit(50);

            if (Array.isArray(targetedData)) {
              targetedData.forEach(row => {
                allRows.push(row);
                ingestRow(row);
              });
            }
          } catch (e) {
            console.warn(`[LastActivity] Targeted query error for account ${accId}:`, e);
          }
        })
      );
    }

    // 3. Cross-propagate max outgoing timestamp across all aliases in the same row
    allRows.forEach((row: any) => {
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

    const nowMs = Date.now();
    const MAX_FUTURE_DRIFT_MS = 60 * 1000; // Allow 1 min clock drift

    let specificTs: number | null = null;
    let lastOutgoingIso: string | null = null;
    let elapsedMinutes: number | null = null;
    let diagnosticError: string | null = null;

    if (accountFilter) {
      const rawVal = lastOutgoingMap[accountFilter];
      if (rawVal && !isNaN(rawVal) && rawVal > 0) {
        specificTs = rawVal;
        lastOutgoingIso = new Date(specificTs).toISOString();

        if (specificTs > nowMs + MAX_FUTURE_DRIFT_MS) {
          diagnosticError = `Timestamp ${specificTs} (${lastOutgoingIso}) is in the future relative to server time ${nowMs} (${new Date(nowMs).toISOString()})`;
          elapsedMinutes = null;
        } else {
          elapsedMinutes = Math.max(0, Math.floor((nowMs - specificTs) / 60000));
        }

        // Strict mathematical consistency verification
        const verifiedIso = new Date(specificTs).toISOString();
        if (verifiedIso !== lastOutgoingIso) {
          diagnosticError = `ISO mismatch: generated '${lastOutgoingIso}' !== recomputed '${verifiedIso}'`;
        }
      }
    }

    return sendJson(res, 200, {
      success: true,
      ...(accountFilter ? {
        account_id: accountFilter,
        last_outgoing_at: specificTs,
        last_outgoing_iso: lastOutgoingIso,
        elapsed_minutes: elapsedMinutes,
        ...(diagnosticError ? { diagnostic_error: diagnosticError } : {})
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
