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

async function fetchWithTimeout(url: string, headers: Record<string, string>, timeoutMs = 12000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal as any
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
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

  const accountId = queryParams.account_id || queryParams.accountId;
  if (!accountId || typeof accountId !== 'string' || !accountId.trim()) {
    return sendJson(res, 400, { success: false, error: "Missing required 'account_id' parameter" });
  }

  const omToken = await getOmToken();
  if (!omToken || !omToken.trim() || omToken.startsWith("om_token_fc269e0")) {
    return sendJson(res, 200, {
      success: false,
      not_configured: true,
      error: "API-ключ OnlyMonster не настроен. Укажите переменную ONLYMONSTER_API_KEY в Vercel."
    });
  }

  let startISO = queryParams.start;
  let endISO = queryParams.end;

  if (!startISO || !endISO) {
    const dayParam = (queryParams.day || 'today').toLowerCase();
    const day = dayParam === 'yesterday' ? 'yesterday' : 'today';
    const range = getOperationalDayRange(day);
    startISO = startISO || range.start;
    endISO = endISO || range.end;
  }

  const cleanToken = omToken.trim();

  try {
    // Parallel fetch: transactions & subscriptions
    const [txResult, subResult] = await Promise.all([
      // a) Fetch transactions with pagination (max 5 pages)
      (async () => {
        let items: any[] = [];
        let cursor: string | null = null;
        let page = 0;
        const maxPages = 5;

        do {
          page++;
          let url = `https://omapi.onlymonster.ai/api/v0/platforms/onlyfans/accounts/${encodeURIComponent(accountId)}/transactions?start=${encodeURIComponent(startISO)}&end=${encodeURIComponent(endISO)}&limit=1000`;
          if (cursor) {
            url += `&cursor=${encodeURIComponent(cursor)}`;
          }

          const response = await fetchWithTimeout(url, {
            'Content-Type': 'application/json',
            'x-om-auth-token': cleanToken
          });

          if (!response.ok) {
            console.error(`[account-detail] Transactions HTTP error ${response.status} for account ${accountId}`);
            break;
          }

          const body: any = await response.json();
          let pageItems: any[] = [];
          cursor = null;

          if (Array.isArray(body)) {
            pageItems = body;
          } else if (body && typeof body === 'object') {
            if (Array.isArray(body.transactions)) pageItems = body.transactions;
            else if (Array.isArray(body.items)) pageItems = body.items;
            else if (Array.isArray(body.data)) pageItems = body.data;
            else if (Array.isArray(body.results)) pageItems = body.results;

            if (typeof body.cursor === 'string' && body.cursor) cursor = body.cursor;
            else if (typeof body.next_cursor === 'string' && body.next_cursor) cursor = body.next_cursor;
            else if (body.pagination && typeof body.pagination.cursor === 'string') cursor = body.pagination.cursor;
            else if (body.pagination && typeof body.pagination.next_cursor === 'string') cursor = body.pagination.next_cursor;
          }

          items.push(...pageItems);
        } while (cursor && page < maxPages);

        return items;
      })(),

      // b) Fetch subscriptions with pagination (max 5 pages)
      (async () => {
        let items: any[] = [];
        let cursor: string | null = null;
        let page = 0;
        const maxPages = 5;

        do {
          page++;
          let url = `https://omapi.onlymonster.ai/api/v0/platforms/onlyfans/accounts/${encodeURIComponent(accountId)}/subscriptions?start=${encodeURIComponent(startISO)}&end=${encodeURIComponent(endISO)}&limit=1000`;
          if (cursor) {
            url += `&cursor=${encodeURIComponent(cursor)}`;
          }

          const response = await fetchWithTimeout(url, {
            'Content-Type': 'application/json',
            'x-om-auth-token': cleanToken
          });

          if (!response.ok) {
            console.error(`[account-detail] Subscriptions HTTP error ${response.status} for account ${accountId}`);
            break;
          }

          const body: any = await response.json();
          let pageItems: any[] = [];
          cursor = null;

          if (Array.isArray(body)) {
            pageItems = body;
          } else if (body && typeof body === 'object') {
            if (Array.isArray(body.subscriptions)) pageItems = body.subscriptions;
            else if (Array.isArray(body.items)) pageItems = body.items;
            else if (Array.isArray(body.data)) pageItems = body.data;
            else if (Array.isArray(body.results)) pageItems = body.results;

            if (typeof body.cursor === 'string' && body.cursor) cursor = body.cursor;
            else if (typeof body.next_cursor === 'string' && body.next_cursor) cursor = body.next_cursor;
            else if (body.pagination && typeof body.pagination.cursor === 'string') cursor = body.pagination.cursor;
            else if (body.pagination && typeof body.pagination.next_cursor === 'string') cursor = body.pagination.next_cursor;
          }

          items.push(...pageItems);
        } while (cursor && page < maxPages);

        return items;
      })()
    ]);

    // Process transactions by type, excluding returned/refunded
    const txTypeMap: Record<string, { count: number; totalAmount: number }> = {};
    let totalTxCount = 0;
    let totalTxAmount = 0;

    for (const tx of txResult) {
      const status = (tx.status || tx.tx_status || tx.state || '').toString().toLowerCase();
      const isExcluded =
        status.includes('return') ||
        status.includes('refund') ||
        status.includes('chargeback') ||
        status === 'pending return' ||
        status === 'pending_return' ||
        status === 'refunded';

      if (!isExcluded) {
        const rawType = (tx.type || tx.tx_type || tx.category || 'unknown').toString().trim();
        const rawAmt = tx.amount !== undefined ? tx.amount : (tx.sum !== undefined ? tx.sum : 0);
        const val = typeof rawAmt === 'number' ? rawAmt : (parseFloat(rawAmt) || 0);

        if (!txTypeMap[rawType]) {
          txTypeMap[rawType] = { count: 0, totalAmount: 0 };
        }
        txTypeMap[rawType].count += 1;
        txTypeMap[rawType].totalAmount += val;

        totalTxCount += 1;
        totalTxAmount += val;
      }
    }

    const transactionsByType = Object.entries(txTypeMap).map(([type, data]) => ({
      type,
      count: data.count,
      totalAmount: Math.round(data.totalAmount * 100) / 100
    })).sort((a, b) => b.totalAmount - a.totalAmount);

    // Process subscriptions
    let newSubs = 0;
    let prolongSubs = 0;
    let returnedSubs = 0;
    let unknownActionSubs = 0;
    const subTypeMap: Record<string, number> = {};

    for (const sub of subResult) {
      const action = (sub.action || sub.event || '').toString().toLowerCase().trim();
      if (action === 'subscribe' || action === 'subscription' || action === 'new') {
        newSubs += 1;
      } else if (action === 'prolong' || action === 'renew' || action === 'renewed' || action === 'recurring') {
        prolongSubs += 1;
      } else if (action === 'return' || action === 'returned' || action === 'refund' || action === 'refunded' || action === 'chargeback') {
        returnedSubs += 1;
      } else {
        unknownActionSubs += 1;
      }

      const subType = (sub.type || sub.sub_type || sub.plan_type || 'regular').toString().trim() || 'unknown';
      subTypeMap[subType] = (subTypeMap[subType] || 0) + 1;
    }

    return sendJson(res, 200, {
      success: true,
      accountId,
      period: {
        start: startISO,
        end: endISO
      },
      summary: {
        totalTransactions: totalTxCount,
        totalAmount: Math.round(totalTxAmount * 100) / 100,
        totalSubscriptions: subResult.length
      },
      transactionsByType,
      subscriptions: {
        new: newSubs,
        renewals: prolongSubs,
        returned: returnedSubs,
        unknownAction: unknownActionSubs,
        byType: subTypeMap,
        byAction: {
          subscribe: newSubs,
          prolong: prolongSubs,
          return: returnedSubs,
          unknown: unknownActionSubs
        }
      }
    });

  } catch (err: any) {
    console.error(`[account-detail] Exception for account ${accountId}:`, err);
    return sendJson(res, 200, {
      success: false,
      error: `Error processing account detail: ${err.message || err}`
    });
  }
}
