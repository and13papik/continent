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

  const sortByParam = (queryParams.sortBy || 'messages').toLowerCase();
  const validSortBy = ['messages', 'reply_time', 'ppv_sent', 'ppv_sold', 'earnings'].includes(sortByParam)
    ? sortByParam
    : 'messages';

  const defaultSortDir = validSortBy === 'reply_time' ? 'asc' : 'desc';
  const sortDirParam = (queryParams.sortDir || defaultSortDir).toLowerCase();
  const sortDir = sortDirParam === 'asc' ? 'asc' : 'desc';

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
    const operatorsMap = new Map<string, {
      user_id: string;
      name: string;
      avatar: string;
      messages_count: number;
      paid_messages_count: number;
      sold_messages_count: number;
      earnings: number;
      reply_time_sum: number;
      reply_time_count: number;
      fans_count: number;
      creator_ids: Set<string>;
    }>();

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

        const fansCount = typeof item.fans_count === 'number'
          ? item.fans_count
          : (typeof item.fans === 'number' ? item.fans : (typeof item.dialogs_count === 'number' ? item.dialogs_count : 0));

        const soldMessagesPrice = typeof item.sold_messages_price_sum === 'number'
          ? item.sold_messages_price_sum
          : (parseFloat(item.sold_messages_price_sum) || 0);

        const soldPostsPrice = typeof item.sold_posts_price_sum === 'number'
          ? item.sold_posts_price_sum
          : (parseFloat(item.sold_posts_price_sum) || 0);

        const tipsAmount = typeof item.tips_amount_sum === 'number'
          ? item.tips_amount_sum
          : (parseFloat(item.tips_amount_sum) || 0);

        const itemEarnings = soldMessagesPrice + soldPostsPrice + tipsAmount;

        const replyTimeAvg = typeof item.reply_time_avg === 'number'
          ? item.reply_time_avg
          : (typeof item.reply_time === 'number' ? item.reply_time : null);

        let rawCreatorIds: any[] = [];
        if (Array.isArray(item.creator_ids)) {
          rawCreatorIds = item.creator_ids;
        } else if (Array.isArray(item.creators)) {
          rawCreatorIds = item.creators;
        } else if (item.creator_id !== undefined && item.creator_id !== null) {
          rawCreatorIds = [item.creator_id];
        }

        const existing = operatorsMap.get(userId);
        if (existing) {
          existing.messages_count += messagesCount;
          existing.paid_messages_count += paidMessagesCount;
          existing.sold_messages_count += soldMessagesCount;
          existing.earnings += itemEarnings;
          existing.fans_count += fansCount;
          if (replyTimeAvg !== null) {
            existing.reply_time_sum += replyTimeAvg;
            existing.reply_time_count += 1;
          }
          for (const cId of rawCreatorIds) {
            if (cId !== undefined && cId !== null && cId !== '') {
              existing.creator_ids.add(String(cId));
            }
          }
        } else {
          const creatorSet = new Set<string>();
          for (const cId of rawCreatorIds) {
            if (cId !== undefined && cId !== null && cId !== '') {
              creatorSet.add(String(cId));
            }
          }
          operatorsMap.set(userId, {
            user_id: userId,
            name: displayName,
            avatar,
            messages_count: messagesCount,
            paid_messages_count: paidMessagesCount,
            sold_messages_count: soldMessagesCount,
            earnings: itemEarnings,
            reply_time_sum: replyTimeAvg !== null ? replyTimeAvg : 0,
            reply_time_count: replyTimeAvg !== null ? 1 : 0,
            fans_count: fansCount,
            creator_ids: creatorSet
          });
        }
      }
    }

    const rawOperators = Array.from(operatorsMap.values()).map(op => ({
      user_id: op.user_id,
      name: op.name,
      avatar: op.avatar,
      messages_count: op.messages_count,
      paid_messages_count: op.paid_messages_count,
      sold_messages_count: op.sold_messages_count,
      fans_count: op.fans_count,
      earnings: Math.round(op.earnings * 100) / 100,
      reply_time_avg: op.reply_time_count > 0 ? Math.round(op.reply_time_sum / op.reply_time_count) : null,
      creator_ids: Array.from(op.creator_ids)
    }));

    // Benchmark targets calculations for gauges
    const activeWithMsg = rawOperators.filter(op => op.messages_count > 0);
    const avgMessages = activeWithMsg.length > 0
      ? Math.round(activeWithMsg.reduce((acc, op) => acc + op.messages_count, 0) / activeWithMsg.length)
      : 0;

    const totalPaidMsg = rawOperators.reduce((acc, op) => acc + op.paid_messages_count, 0);
    const totalFans = rawOperators.reduce((acc, op) => acc + op.fans_count, 0);
    const teamPpvPerFanRatio = totalPaidMsg / Math.max(totalFans, 1);
    const maxMessagesInList = Math.max(...rawOperators.map(op => op.messages_count), 0);

    const operators = rawOperators.map(op => {
      const targetPpvSent = Math.round((op.fans_count || 0) * teamPpvPerFanRatio);
      const conversionPct = op.paid_messages_count > 0
        ? Math.round((op.sold_messages_count / op.paid_messages_count) * 100)
        : 0;

      return {
        ...op,
        gauges: {
          messages: {
            value: op.messages_count,
            target: 80,
            max: 120
          },
          reply_time: {
            value: op.reply_time_avg,
            goodThreshold: 110,
            okThreshold: 300,
            max: 600
          },
          ppv_sent: {
            value: op.paid_messages_count,
            target: targetPpvSent,
            max: Math.max(Math.round(targetPpvSent * 2), Math.round(op.paid_messages_count * 1.1), 10)
          },
          ppv_sold: {
            value: conversionPct,
            okThreshold: 12,
            goodThreshold: 20,
            ultraThreshold: 35,
            max: 100
          }
        }
      };
    });

    // 4. Sort operators by requested field and direction
    operators.sort((a, b) => {
      let valA = 0;
      let valB = 0;

      if (validSortBy === 'reply_time') {
        const rtA = a.reply_time_avg;
        const rtB = b.reply_time_avg;
        if (rtA === null && rtB === null) return 0;
        if (rtA === null) return 1;
        if (rtB === null) return -1;
        valA = rtA;
        valB = rtB;
      } else if (validSortBy === 'ppv_sent') {
        valA = a.paid_messages_count;
        valB = b.paid_messages_count;
      } else if (validSortBy === 'ppv_sold') {
        valA = a.sold_messages_count;
        valB = b.sold_messages_count;
      } else if (validSortBy === 'earnings') {
        valA = a.earnings;
        valB = b.earnings;
      } else {
        // messages
        valA = a.messages_count;
        valB = b.messages_count;
      }

      if (sortDir === 'asc') {
        return valA - valB;
      } else {
        return valB - valA;
      }
    });

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
