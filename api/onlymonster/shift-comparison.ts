import { getOmToken } from '../_lib/om-store.js';
import { getAllAccountsShiftEarnings } from './earnings.js';
import { 
  getCurrentKyivShiftIndex, 
  getShiftRangeForDay, 
  getShiftRangeForDate,
  getKyivDateStr,
  SHIFTS_CONFIG 
} from '../_lib/shifts.js';

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

async function fetchWithTimeout(url: string, headers: Record<string, string>, timeoutMs = 8000): Promise<Response> {
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

async function fetchShiftMetrics(
  url: string,
  headers: Record<string, string>
): Promise<{ totalMessages: number; totalEarnings: number; operatorCount: number; error?: string }> {
  let totalMessages = 0;
  let totalEarnings = 0;
  const userSet = new Set<string>();

  let offset = 0;
  const limit = 100;
  const maxPages = 3;

  for (let page = 0; page < maxPages; page++) {
    const pageUrl = `${url}&offset=${offset}&limit=${limit}`;
    let response: Response;
    try {
      response = await fetchWithTimeout(pageUrl, headers);
    } catch (err: any) {
      return { totalMessages: 0, totalEarnings: 0, operatorCount: 0, error: err.message };
    }

    if (!response.ok) break;

    const body: any = await response.json();
    let pageItems: any[] = [];
    if (Array.isArray(body)) {
      pageItems = body;
    } else if (body && typeof body === 'object') {
      pageItems = body.items || body.metrics || body.data || body.results || [];
    }

    for (const item of pageItems) {
      const msgCount = typeof item.messages_count === 'number'
        ? item.messages_count
        : (item.messages || item.sent_messages || 0);

      if (msgCount > 0) {
        totalMessages += msgCount;

        const soldMsgs = typeof item.sold_messages_price_sum === 'number'
          ? item.sold_messages_price_sum
          : (parseFloat(item.sold_messages_price_sum) || 0);
        const soldPosts = typeof item.sold_posts_price_sum === 'number'
          ? item.sold_posts_price_sum
          : (parseFloat(item.sold_posts_price_sum) || 0);
        const tips = typeof item.tips_amount_sum === 'number'
          ? item.tips_amount_sum
          : (parseFloat(item.tips_amount_sum) || 0);

        totalEarnings += (soldMsgs + soldPosts + tips);

        const userId = String(item.user_id || item.id || item.member_id || '');
        if (userId) {
          userSet.add(userId);
        }
      }
    }

    if (pageItems.length < limit) break;
    offset += limit;
  }

  return {
    totalMessages,
    totalEarnings: Math.round(totalEarnings * 100) / 100,
    operatorCount: userSet.size
  };
}

export default async function handler(req: any, res: any) {
  const method = req.method || 'GET';
  if (method !== 'GET') {
    return sendJson(res, 405, { error: 'Метод не поддерживается' });
  }

  const omToken = await getOmToken();
  if (!omToken || !omToken.trim() || omToken.startsWith("om_token_fc269e0")) {
    return sendJson(res, 200, {
      success: false,
      not_configured: true,
      error: "API-ключ OnlyMonster не настроен."
    });
  }

  const token = omToken.trim();
  const headers = {
    'Content-Type': 'application/json',
    'x-om-auth-token': token
  };

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

  const scope = (queryParams.scope || 'day').toLowerCase() === 'week' ? 'week' : 'day';
  const day = (queryParams.day || 'today').toLowerCase() === 'yesterday' ? 'yesterday' : 'today';

  const startTime = Date.now();

  try {
    if (scope === 'day') {
      const currentShiftIdx = getCurrentKyivShiftIndex();
      const shiftsRes: any[] = [];

      let accountShiftTotals: { 1: number; 2: number; 3: number; 4: number } = { 1: 0, 2: 0, 3: 0, 4: 0 };
      try {
        accountShiftTotals = await getAllAccountsShiftEarnings(token, day);
      } catch (errAcc: any) {
        console.error('[shift-comparison] Error in getAllAccountsShiftEarnings:', errAcc?.message || errAcc);
      }

      for (let s = 1; s <= 4; s++) {
        const isFuture = day === 'today' && s > currentShiftIdx;
        const config = SHIFTS_CONFIG[s - 1];

        if (isFuture) {
          shiftsRes.push({
            index: s,
            label: config.label,
            totalMessages: null,
            totalEarnings: null,
            accountEarnings: null,
            diff: null,
            operatorCount: 0,
            isFuture: true
          });
          continue;
        }

        const range = getShiftRangeForDay(day, s as 1 | 2 | 3 | 4);
        const url = `https://omapi.onlymonster.ai/api/v0/users/metrics?from=${encodeURIComponent(range.start)}&to=${encodeURIComponent(range.end)}`;

        const data = await fetchShiftMetrics(url, headers);

        const accountEarnings = accountShiftTotals[s as 1 | 2 | 3 | 4] ?? 0;
        const operatorEarnings = data.totalEarnings ?? 0;
        const diff = Math.round((accountEarnings - operatorEarnings) * 100) / 100;

        shiftsRes.push({
          index: s,
          label: range.label,
          totalMessages: data.totalMessages,
          totalEarnings: operatorEarnings,
          accountEarnings,
          diff,
          operatorCount: data.operatorCount,
          isFuture: false
        });

        // Small pause between shift requests to prevent rate limiting
        await new Promise(r => setTimeout(r, 100));
      }

      // Calculate strongest and weakest indexes
      const validShifts = shiftsRes.filter(s => !s.isFuture && s.totalEarnings !== null);
      let strongestIndex: number | null = null;
      let weakestIndex: number | null = null;

      if (validShifts.length > 0) {
        let maxVal = -1;
        let minVal = Infinity;

        for (const s of validShifts) {
          if (s.totalEarnings > maxVal) {
            maxVal = s.totalEarnings;
            strongestIndex = s.index;
          }
          if (s.totalEarnings > 0 && s.totalEarnings < minVal) {
            minVal = s.totalEarnings;
            weakestIndex = s.index;
          }
        }
        // If all valid shifts had 0 earnings, pick min among all valid
        if (weakestIndex === null && validShifts.length > 1) {
          weakestIndex = validShifts[0].index;
        }
      }

      return sendJson(res, 200, {
        success: true,
        scope: 'day',
        day,
        shifts: shiftsRes,
        strongestIndex,
        weakestIndex
      });
    } else {
      // scope === 'week'
      const todayStr = getKyivDateStr(0);
      const todayDate = new Date(`${todayStr}T00:00:00Z`);
      const dayOfWeek = todayDate.getUTCDay(); // 0=Sun, 1=Mon...
      const daysSinceMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

      const dates: string[] = [];
      for (let i = daysSinceMon; i >= 0; i--) {
        dates.push(getKyivDateStr(-i));
      }

      const currentShiftIdx = getCurrentKyivShiftIndex();
      const tasks: { dateStr: string; shiftIndex: 1 | 2 | 3 | 4 }[] = [];

      for (const dStr of dates) {
        const isToday = dStr === todayStr;
        for (let s = 1; s <= 4; s++) {
          if (isToday && s > currentShiftIdx) {
            continue; // Skip future shift for today
          }
          tasks.push({ dateStr: dStr, shiftIndex: s as 1 | 2 | 3 | 4 });
        }
      }

      const shiftStats: Record<number, { totalMessages: number; totalEarnings: number; daysCounted: number }> = {
        1: { totalMessages: 0, totalEarnings: 0, daysCounted: 0 },
        2: { totalMessages: 0, totalEarnings: 0, daysCounted: 0 },
        3: { totalMessages: 0, totalEarnings: 0, daysCounted: 0 },
        4: { totalMessages: 0, totalEarnings: 0, daysCounted: 0 }
      };

      let isPartial = false;
      const batchSize = 5;

      for (let i = 0; i < tasks.length; i += batchSize) {
        if (Date.now() - startTime > 7500) {
          isPartial = true;
          break;
        }

        const chunk = tasks.slice(i, i + batchSize);
        await Promise.all(chunk.map(async (task) => {
          const range = getShiftRangeForDate(task.dateStr, task.shiftIndex);
          const url = `https://omapi.onlymonster.ai/api/v0/users/metrics?from=${encodeURIComponent(range.start)}&to=${encodeURIComponent(range.end)}`;
          const data = await fetchShiftMetrics(url, headers);

          const st = shiftStats[task.shiftIndex];
          st.totalMessages += data.totalMessages;
          st.totalEarnings += data.totalEarnings;
          st.daysCounted += 1;
        }));

        if (i + batchSize < tasks.length) {
          await new Promise(r => setTimeout(r, 150));
        }
      }

      const shiftsRes = SHIFTS_CONFIG.map(config => {
        const st = shiftStats[config.index];
        const daysCounted = st ? st.daysCounted : 0;
        const totalEarnings = st ? Math.round(st.totalEarnings * 100) / 100 : 0;
        const totalMessages = st ? st.totalMessages : 0;
        const avgEarningsPerDay = daysCounted > 0 ? Math.round((totalEarnings / daysCounted) * 100) / 100 : 0;
        const avgMessagesPerDay = daysCounted > 0 ? Math.round(totalMessages / daysCounted) : 0;

        return {
          index: config.index,
          label: config.label,
          totalMessages,
          totalEarnings,
          daysCounted,
          avgEarningsPerDay,
          avgMessagesPerDay,
          isFuture: daysCounted === 0
        };
      });

      const activeShifts = shiftsRes.filter(s => s.daysCounted > 0);
      let strongestIndex: number | null = null;
      let weakestIndex: number | null = null;

      if (activeShifts.length > 0) {
        let maxVal = -1;
        let minVal = Infinity;

        for (const s of activeShifts) {
          if (s.avgEarningsPerDay > maxVal) {
            maxVal = s.avgEarningsPerDay;
            strongestIndex = s.index;
          }
          if (s.avgEarningsPerDay > 0 && s.avgEarningsPerDay < minVal) {
            minVal = s.avgEarningsPerDay;
            weakestIndex = s.index;
          }
        }
        if (weakestIndex === null && activeShifts.length > 1) {
          weakestIndex = activeShifts[0].index;
        }
      }

      return sendJson(res, 200, {
        success: true,
        scope: 'week',
        weekLabel: "Текущая неделя",
        shifts: shiftsRes,
        strongestIndex,
        weakestIndex,
        partial: isPartial
      });
    }
  } catch (err: any) {
    return sendJson(res, 200, {
      success: false,
      error: `Ошибка при обработке сравнения смен: ${err.message || err}`
    });
  }
}
