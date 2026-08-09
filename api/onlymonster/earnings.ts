import { getOmToken } from '../_lib/om-store.js';

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

function getKyivTimeRangeISO() {
  const now = new Date();
  const endISO = now.toISOString();

  // Get current date in Europe/Kyiv timezone (YYYY-MM-DD)
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Kyiv",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  const dateParts = formatter.format(now); // "YYYY-MM-DD"
  const utcMidnight = new Date(`${dateParts}T00:00:00.000Z`);

  // Get local hour in Kyiv at UTC midnight to determine timezone offset
  const hourFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Kyiv",
    hour: "numeric",
    hour12: false
  });
  const kyivHour = parseInt(hourFormatter.format(utcMidnight), 10) || 0;

  // Subtract offset to get UTC start time corresponding to 00:00 in Europe/Kyiv
  const startMs = utcMidnight.getTime() - (kyivHour * 3600000);
  const startISO = new Date(startMs).toISOString();

  return { start: startISO, end: endISO };
}

async function getAccountEarningsToday(
  platformAccountId: string,
  token: string,
  startISO: string,
  endISO: string
): Promise<{ today: number | null; currency?: string; error?: string }> {
  let totalAmount = 0;
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
        return { today: null, error: errorMsg };
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
          const rawAmt = tx.amount !== undefined ? tx.amount : tx.sum;
          const val = typeof rawAmt === 'number' ? rawAmt : parseFloat(rawAmt);
          if (!isNaN(val)) {
            totalAmount += val;
          }
        }
      }

    } while (cursor && page < maxPages);

    const rounded = Math.round(totalAmount * 100) / 100;
    return { today: rounded, currency: 'USD' };
  } catch (err: any) {
    return { today: null, error: err.message || 'Network error' };
  }
}

export default async function handler(req: any, res: any) {
  const method = req.method || 'GET';
  if (method !== 'GET') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const query = req.query || {};
  let accountsParam = query.accounts;
  if (!accountsParam && req.url) {
    try {
      const parsedUrl = new URL(req.url, 'http://localhost');
      accountsParam = parsedUrl.searchParams.get('accounts');
    } catch (e) {}
  }

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

  const { start, end } = getKyivTimeRangeISO();

  try {
    const results = await Promise.all(
      accountIds.map(async (platformAccountId) => {
        const resData = await getAccountEarningsToday(platformAccountId, omToken.trim(), start, end);
        return { id: platformAccountId, resData };
      })
    );

    const earnings: Record<string, { today: number | null; currency?: string; error?: string }> = {};
    for (const { id, resData } of results) {
      earnings[id] = resData;
    }

    return sendJson(res, 200, {
      success: true,
      earnings
    });
  } catch (err: any) {
    return sendJson(res, 200, {
      success: false,
      error: `Internal server error: ${err.message || err}`
    });
  }
}
