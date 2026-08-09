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

  const userId = queryParams.user_id || queryParams.userId;
  const creatorId = queryParams.creator_id || queryParams.creatorId;
  const start = queryParams.start;
  const end = queryParams.end;

  if (!userId || !creatorId || !start || !end) {
    return sendJson(res, 400, {
      success: false,
      error: "Отсутствуют обязательные параметры (user_id, creator_id, start, end)."
    });
  }

  try {
    const url = `https://omapi.onlymonster.ai/api/v0/users/metrics?from=${encodeURIComponent(start)}&to=${encodeURIComponent(end)}&user_ids=${encodeURIComponent(userId)}&creator_ids=${encodeURIComponent(creatorId)}&offset=0&limit=100`;

    let response: Response;
    try {
      response = await fetchWithTimeout(url, headers);
    } catch (err: any) {
      return sendJson(res, 200, {
        success: false,
        error: "Ошибка подключения к OnlyMonster API."
      });
    }

    if (!response.ok) {
      return sendJson(res, 200, {
        success: false,
        error: `OnlyMonster API вернул статус ${response.status}`
      });
    }

    const body: any = await response.json();
    let pageItems: any[] = [];
    if (Array.isArray(body)) {
      pageItems = body;
    } else if (body && typeof body === 'object') {
      pageItems = body.items || body.metrics || body.data || body.results || [];
    }

    let messagesCount = 0;
    let paidMessagesCount = 0;
    let soldMessagesCount = 0;
    let totalEarnings = 0;
    let replyTimeSum = 0;
    let replyTimeCount = 0;

    for (const item of pageItems) {
      const msgCount = typeof item.messages_count === 'number'
        ? item.messages_count
        : (item.messages || item.sent_messages || 0);

      messagesCount += msgCount;

      const paidMsgs = typeof item.paid_messages_count === 'number'
        ? item.paid_messages_count
        : (item.paid_messages || 0);
      paidMessagesCount += paidMsgs;

      const soldMsgs = typeof item.sold_messages_count === 'number'
        ? item.sold_messages_count
        : (item.sold_messages || 0);
      soldMessagesCount += soldMsgs;

      const soldMsgsPrice = typeof item.sold_messages_price_sum === 'number'
        ? item.sold_messages_price_sum
        : (parseFloat(item.sold_messages_price_sum) || 0);
      const soldPostsPrice = typeof item.sold_posts_price_sum === 'number'
        ? item.sold_posts_price_sum
        : (parseFloat(item.sold_posts_price_sum) || 0);
      const tipsAmount = typeof item.tips_amount_sum === 'number'
        ? item.tips_amount_sum
        : (parseFloat(item.tips_amount_sum) || 0);

      totalEarnings += (soldMsgsPrice + soldPostsPrice + tipsAmount);

      const replyTime = typeof item.reply_time_avg === 'number'
        ? item.reply_time_avg
        : (typeof item.reply_time === 'number' ? item.reply_time : null);

      if (replyTime !== null) {
        replyTimeSum += replyTime;
        replyTimeCount += 1;
      }
    }

    const replyTimeAvg = replyTimeCount > 0 ? Math.round(replyTimeSum / replyTimeCount) : null;

    return sendJson(res, 200, {
      success: true,
      user_id: userId,
      creator_id: creatorId,
      metrics: {
        messages_count: messagesCount,
        paid_messages_count: paidMessagesCount,
        sold_messages_count: soldMessagesCount,
        reply_time_avg: replyTimeAvg,
        earnings: Math.round(totalEarnings * 100) / 100
      }
    });
  } catch (err: any) {
    return sendJson(res, 200, {
      success: false,
      error: `Ошибка получения детализации оператора по модели: ${err.message || err}`
    });
  }
}
