import { getOmToken } from '../_lib/om-store.js';
import { 
  getCurrentKyivShift, 
  getCurrentKyivShiftIndex, 
  getShiftRangeForDay, 
  getWeekRange, 
  getMonthRange,
  KyivShift 
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

async function fetchWithTimeout(url: string, headers: Record<string, string>, timeoutMs = 10000): Promise<Response> {
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
    return sendJson(res, 405, { error: 'Метод не поддерживается' });
  }

  const omToken = await getOmToken();
  if (!omToken || !omToken.trim() || omToken.startsWith("om_token_fc269e0")) {
    return sendJson(res, 200, {
      success: false,
      not_configured: true,
      error: "API-ключ OnlyMonster не настроен. Укажите переменную ONLYMONSTER_API_KEY в Vercel."
    });
  }

  const token = omToken.trim();

  // Parse query parameters
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

  const period = (queryParams.period || 'shift').toLowerCase();
  const day = (queryParams.day || 'today').toLowerCase();
  const shiftParam = queryParams.shift;

  let range: KyivShift;

  if (period === 'week') {
    range = getWeekRange();
  } else if (period === 'month') {
    range = getMonthRange();
  } else {
    // period === 'shift'
    if (day === 'yesterday') {
      if (!shiftParam || !['1', '2', '3', '4'].includes(String(shiftParam))) {
        return sendJson(res, 400, {
          success: false,
          error: 'Укажите номер смены для вчерашнего дня'
        });
      }
      const shiftNum = Number(shiftParam) as 1 | 2 | 3 | 4;
      range = getShiftRangeForDay('yesterday', shiftNum);
    } else {
      // day === 'today'
      if (shiftParam && ['1', '2', '3', '4'].includes(String(shiftParam))) {
        const shiftNum = Number(shiftParam) as 1 | 2 | 3 | 4;
        range = getShiftRangeForDay('today', shiftNum);
      } else {
        range = getCurrentKyivShift();
      }
    }
  }

  try {
    const headers = {
      'Content-Type': 'application/json',
      'x-om-auth-token': token
    };

    // 1. Fetch User Metrics for the calculated range
    let metricsItems: any[] = [];
    let metricsOffset = 0;
    const metricsLimit = 100;
    const maxMetricsPages = 5;

    for (let page = 0; page < maxMetricsPages; page++) {
      const url = `https://omapi.onlymonster.ai/api/v0/users/metrics?from=${encodeURIComponent(range.start)}&to=${encodeURIComponent(range.end)}&offset=${metricsOffset}&limit=${metricsLimit}`;
      let response: Response;
      try {
        response = await fetchWithTimeout(url, headers);
      } catch (err: any) {
        return sendJson(res, 200, {
          success: false,
          error: "Ошибка соединения с OnlyMonster API при запросе метрик операторов."
        });
      }

      if (!response.ok) {
        let errText = `Ошибка OnlyMonster API (${response.status})`;
        try {
          const errBody = await response.json();
          if (errBody && (errBody.error || errBody.message)) {
            errText = errBody.error || errBody.message;
          }
        } catch (e) {}
        return sendJson(res, 200, { success: false, error: errText });
      }

      const body: any = await response.json();
      let pageItems: any[] = [];
      if (Array.isArray(body)) {
        pageItems = body;
      } else if (body && typeof body === 'object') {
        pageItems = body.items || body.metrics || body.data || body.results || [];
      }

      metricsItems.push(...pageItems);
      if (pageItems.length < metricsLimit) {
        break;
      }
      metricsOffset += metricsLimit;
    }

    // 2. Fetch Members to map user_id -> Name & Avatar
    let membersMap = new Map<string, { name: string; customName: string; avatar: string }>();
    let memberOffset = 0;
    const memberLimit = 50;
    const maxMemberPages = 10;

    for (let page = 0; page < maxMemberPages; page++) {
      const url = `https://omapi.onlymonster.ai/api/v0/members?limit=${memberLimit}&offset=${memberOffset}`;
      let response: Response;
      try {
        response = await fetchWithTimeout(url, headers);
      } catch (err) {
        break; // Non-fatal: if members fetch fails, fall back to metric user_ids
      }

      if (!response.ok) break;

      const body: any = await response.json();
      let pageMembers: any[] = [];
      if (Array.isArray(body)) {
        pageMembers = body;
      } else if (body && typeof body === 'object') {
        pageMembers = body.members || body.users || body.items || body.data || [];
      }

      for (const m of pageMembers) {
        const id = String(m.id || m.user_id || m.member_id || '');
        if (id) {
          membersMap.set(id, {
            name: m.name || m.username || m.display_name || '',
            customName: m.custom_name || m.customName || m.custom_title || '',
            avatar: m.avatar || m.avatar_url || m.photo || m.image || ''
          });
        }
      }

      if (pageMembers.length < memberLimit) {
        break;
      }
      memberOffset += memberLimit;
    }

    // 3. Process and format operator metrics
    const operators: Array<{
      user_id: string;
      name: string;
      avatar: string;
      messages_count: number;
      paid_messages_count: number;
      sold_messages_count: number;
      reply_time_avg: number | null;
    }> = [];

    for (const item of metricsItems) {
      const messagesCount = typeof item.messages_count === 'number'
        ? item.messages_count
        : (item.messages || item.sent_messages || 0);

      if (messagesCount > 0) {
        const userId = String(item.user_id || item.id || item.member_id || '');
        const memberInfo = membersMap.get(userId);

        const displayName = (memberInfo && (memberInfo.customName || memberInfo.name))
          ? (memberInfo.customName || memberInfo.name)
          : (item.user_name || item.name || `Оператор #${userId || '?'}`);

        const avatar = memberInfo?.avatar || item.avatar || item.avatar_url || '';

        const paidMessagesCount = typeof item.paid_messages_count === 'number'
          ? item.paid_messages_count
          : (item.paid_messages || 0);

        const soldMessagesCount = typeof item.sold_messages_count === 'number'
          ? item.sold_messages_count
          : (item.sold_messages || 0);

        const replyTimeAvg = typeof item.reply_time_avg === 'number'
          ? item.reply_time_avg
          : (typeof item.reply_time === 'number' ? item.reply_time : null);

        // TODO: правильная агрегация reply_time_avg при нескольких аккаунтах на одного оператора

        operators.push({
          user_id: userId,
          name: displayName,
          avatar,
          messages_count: messagesCount,
          paid_messages_count: paidMessagesCount,
          sold_messages_count: soldMessagesCount,
          reply_time_avg: replyTimeAvg
        });
      }
    }

    // 4. Sort operators by messages_count descending
    operators.sort((a, b) => b.messages_count - a.messages_count);

    return sendJson(res, 200, {
      success: true,
      period: {
        mode: period,
        day: period === 'shift' ? day : undefined,
        shift: period === 'shift' ? (shiftParam || getCurrentKyivShiftIndex()) : undefined
      },
      shift: {
        label: range.label,
        start: range.start,
        end: range.end
      },
      operators
    });
  } catch (err: any) {
    return sendJson(res, 200, {
      success: false,
      error: `Внутренняя ошибка сервера: ${err.message || err}`
    });
  }
}
