import { getOmToken } from '../_lib/om-store.js';
import { getOperationalDayRange } from '../_lib/shifts.js';

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

async function getAccountEarnings(
  platformAccountId: string,
  token: string,
  startISO: string,
  endISO: string,
  includeBreakdown: boolean,
  label: string
): Promise<{
  total: number | null;
  today?: number | null;
  currency: string;
  label: string;
  breakdown?: { 1: number; 2: number; 3: number; 4: number };
  error?: string;
}> {
  let totalAmount = 0;
  let txCount = 0;
  const shiftTotals = { 1: 0, 2: 0, 3: 0, 4: 0 };
  let cursor: string | null = null;
  let page = 0;
  const maxPages = 5;

  try {
    do {
      page++;
      let url = `https://omapi.onlymonster.ai/api/v0/platforms/onlyfans/accounts/${encodeURIComponent(platformAccountId)}/transactions?start=${encodeURIComponent(startISO)}&end=${encodeURIComponent(endISO)}&limit=1000`;
      if (cursor) {
        url += `&cursor=${encodeURIComponent(cursor)}`;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-om-auth-token': token
        },
        signal: controller.signal as any
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errBody: any = null;
        try { errBody = await response.json(); } catch (e) {}
        const errorMsg = (errBody && (errBody.error || errBody.message)) || `HTTP ${response.status}`;
        console.error(`[getAccountEarnings] HTTP error fetching transactions for account ${platformAccountId}: ${response.status}`, errorMsg);
        return { total: null, today: null, currency: 'USD', label, error: errorMsg };
      }

      const body: any = await response.json();
      let items: any[] = [];
      cursor = null;

      if (Array.isArray(body)) {
        items = body;
      } else if (body && typeof body === 'object') {
        if (Array.isArray(body.transactions)) {
          items = body.transactions;
        } else if (Array.isArray(body.items)) {
          items = body.items;
        } else if (Array.isArray(body.data)) {
          items = body.data;
        } else if (Array.isArray(body.results)) {
          items = body.results;
        }

        if (typeof body.cursor === 'string' && body.cursor) {
          cursor = body.cursor;
        } else if (typeof body.next_cursor === 'string' && body.next_cursor) {
          cursor = body.next_cursor;
        } else if (body.pagination && typeof body.pagination.cursor === 'string' && body.pagination.cursor) {
          cursor = body.pagination.cursor;
        } else if (body.pagination && typeof body.pagination.next_cursor === 'string' && body.pagination.next_cursor) {
          cursor = body.pagination.next_cursor;
        }
      }

      for (const tx of items) {
        const status = (tx.status || tx.tx_status || tx.state || '').toString().toLowerCase();
        const isExcludedStatus =
          status.includes('return') ||
          status.includes('refund') ||
          status.includes('chargeback') ||
          status === 'pending return' ||
          status === 'pending_return' ||
          status === 'refund' ||
          status === 'refunded' ||
          status === 'chargeback';

        if (!isExcludedStatus) {
          txCount++;
          const rawAmt = tx.amount !== undefined ? tx.amount : tx.sum;
          const val = typeof rawAmt === 'number' ? rawAmt : parseFloat(rawAmt);
          if (!isNaN(val)) {
            totalAmount += val;

            if (includeBreakdown) {
              const rawTs = tx.timestamp || tx.created_at || tx.date || tx.createdAt || tx.time;
              if (rawTs) {
                const txDate = new Date(rawTs);
                if (!isNaN(txDate.getTime())) {
                  const hourFormatter = new Intl.DateTimeFormat("en-US", {
                    timeZone: "Europe/Kyiv",
                    hour: "numeric",
                    hour12: false
                  });
                  const h = parseInt(hourFormatter.format(txDate), 10) || 0;
                  if (h >= 2 && h < 8) shiftTotals[1] += val;
                  else if (h >= 8 && h < 14) shiftTotals[2] += val;
                  else if (h >= 14 && h < 20) shiftTotals[3] += val;
                  else shiftTotals[4] += val;
                }
              }
            }
          }
        }
      }

    } while (cursor && page < maxPages);

    const roundedTotal = Math.round(totalAmount * 100) / 100;
    const resObj: any = {
      total: roundedTotal,
      today: roundedTotal,
      tx_count: txCount,
      currency: 'USD',
      label
    };

    if (includeBreakdown) {
      resObj.breakdown = {
        1: Math.round(shiftTotals[1] * 100) / 100,
        2: Math.round(shiftTotals[2] * 100) / 100,
        3: Math.round(shiftTotals[3] * 100) / 100,
        4: Math.round(shiftTotals[4] * 100) / 100
      };
    }

    return resObj;
  } catch (err: any) {
    console.error(`[getAccountEarnings] Network or execution exception for account ${platformAccountId}:`, err?.message || err);
    return { total: null, today: null, currency: 'USD', label, error: err.message || 'Network error' };
  }
}

export async function getAllAccountsShiftEarnings(
  token: string,
  day: 'today' | 'yesterday',
  providedAccountIds?: string[]
): Promise<{ 1: number; 2: number; 3: number; 4: number }> {
  const shiftTotals = { 1: 0, 2: 0, 3: 0, 4: 0 };
  try {
    let platformAccountIds: string[] = providedAccountIds && providedAccountIds.length > 0
      ? providedAccountIds
      : [];

    if (platformAccountIds.length === 0) {
      const accRes = await fetch('https://omapi.onlymonster.ai/api/v0/platforms/onlyfans/accounts', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-om-auth-token': token
        }
      });

      if (!accRes.ok) {
        console.error(`[getAllAccountsShiftEarnings] Failed to fetch accounts from OnlyMonster API. Status: ${accRes.status}`);
        return shiftTotals;
      }

      const body: any = await accRes.json();
      let accountsList: any[] = [];
      if (Array.isArray(body)) {
        accountsList = body;
      } else if (body && typeof body === 'object') {
        if (Array.isArray(body.accounts)) accountsList = body.accounts;
        else if (Array.isArray(body.items)) accountsList = body.items;
        else if (Array.isArray(body.data)) accountsList = body.data;
        else if (Array.isArray(body.results)) accountsList = body.results;
      }

      platformAccountIds = accountsList
        .map((a: any) => a.platform_account_id || a.id || a.account_id || a.platformAccountId || a.user_id)
        .filter(Boolean);
    }

    if (platformAccountIds.length === 0) {
      console.error('[getAllAccountsShiftEarnings] No platform account IDs found.');
      return shiftTotals;
    }

    const range = getOperationalDayRange(day);

    // Process accounts in batches of 4 to avoid 429 Rate Limits or network timeouts
    const batchSize = 4;
    const results: any[] = [];

    for (let i = 0; i < platformAccountIds.length; i += batchSize) {
      const batch = platformAccountIds.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((id: string) =>
          getAccountEarnings(id, token, range.start, range.end, true, range.label)
        )
      );
      results.push(...batchResults);

      if (i + batchSize < platformAccountIds.length) {
        await new Promise(r => setTimeout(r, 100));
      }
    }

    for (const resData of results) {
      if (resData && resData.breakdown) {
        shiftTotals[1] += resData.breakdown[1] || 0;
        shiftTotals[2] += resData.breakdown[2] || 0;
        shiftTotals[3] += resData.breakdown[3] || 0;
        shiftTotals[4] += resData.breakdown[4] || 0;
      } else if (resData && resData.error) {
        console.error(`[getAllAccountsShiftEarnings] Error calculating earnings for account:`, resData.error);
      }
    }

    const finalTotals = {
      1: Math.round(shiftTotals[1] * 100) / 100,
      2: Math.round(shiftTotals[2] * 100) / 100,
      3: Math.round(shiftTotals[3] * 100) / 100,
      4: Math.round(shiftTotals[4] * 100) / 100
    };

    console.log(`[getAllAccountsShiftEarnings] Processed ${platformAccountIds.length} accounts for day='${day}'. Shift totals:`, finalTotals);

    return finalTotals;
  } catch (e: any) {
    console.error('[getAllAccountsShiftEarnings] Unexpected exception:', e?.message || e);
    return shiftTotals;
  }
}

export default async function handler(req: any, res: any) {
  const method = req.method || 'GET';
  if (method !== 'GET') {
    return sendJson(res, 405, { error: 'Method not allowed' });
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

  const accountsParam = queryParams.accounts;
  if (!accountsParam || typeof accountsParam !== 'string' || !accountsParam.trim()) {
    return sendJson(res, 400, { success: false, error: "Missing required 'accounts' query parameter" });
  }

  const omToken = await getOmToken();
  if (!omToken || !omToken.trim() || omToken.startsWith("om_token_fc269e0")) {
    return sendJson(res, 200, {
      success: false,
      not_configured: true,
      error: "API-ключ OnlyMonster не настроен. Укажите переменную ONLYMONSTER_API_KEY в Vercel."
    });
  }

  const accountIds = accountsParam.split(',').map(s => s.trim()).filter(Boolean);
  if (accountIds.length === 0) {
    return sendJson(res, 400, { success: false, error: "No valid account IDs provided" });
  }

  const dayParam = (queryParams.day || 'today').toLowerCase();
  const day = dayParam === 'yesterday' ? 'yesterday' : 'today';
  const includeBreakdown = (queryParams.breakdown || '').toLowerCase() === 'true';

  const range = getOperationalDayRange(day);

  try {
    const results = await Promise.all(
      accountIds.map(async (platformAccountId) => {
        const resData = await getAccountEarnings(
          platformAccountId,
          omToken.trim(),
          range.start,
          range.end,
          includeBreakdown,
          range.label
        );
        return { id: platformAccountId, resData };
      })
    );

    const earnings: Record<string, any> = {};
    for (const { id, resData } of results) {
      earnings[id] = resData;
    }

    return sendJson(res, 200, {
      success: true,
      day,
      label: range.label,
      range: {
        start: range.start,
        end: range.end
      },
      earnings
    });
  } catch (err: any) {
    return sendJson(res, 200, {
      success: false,
      error: `Internal server error: ${err.message || err}`
    });
  }
}
