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

export default async function handler(req: any, res: any) {
  const method = req.method || 'GET';
  if (method !== 'GET') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const query = req.query || {};
  const subpath = query.path || query.subpath || "accounts";
  if (!subpath || typeof subpath !== 'string') {
    return sendJson(res, 400, { error: "Missing path parameter" });
  }

  const omToken = await getOmToken();
  if (!omToken || !omToken.trim() || omToken.startsWith("om_token_fc269e0")) {
    return sendJson(res, 200, {
      success: false,
      not_configured: true,
      error: "API-ключ OnlyMonster не настроен. Укажите действующий токен в настройках Vercel."
    });
  }

  const cleanSubpath = subpath.replace(/^\//, "");
  const apiUrl = `https://omapi.onlymonster.ai/api/v0/${cleanSubpath}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-om-auth-token": omToken.trim()
      },
      signal: controller.signal as any
    });

    clearTimeout(timeoutId);

    let parsed: any;
    try {
      parsed = await response.json();
    } catch (e) {
      parsed = null;
    }

    if (response.ok) {
      return sendJson(res, 200, parsed);
    }

    let friendlyMsg = `Ошибка API OnlyMonster (код ${response.status})`;
    if (response.status === 401) {
      friendlyMsg = "Неверный API-ключ OnlyMonster (401 Unauthorized). Проверьте токен в настройках.";
    } else if (response.status === 403) {
      friendlyMsg = "Доступ запрещен (403 Forbidden). Проверьте права вашего API-ключа.";
    } else if (response.status === 404) {
      friendlyMsg = "Запрашиваемый ресурс не найден (404 Not Found).";
    } else if (response.status === 429) {
      friendlyMsg = "Превышен лимит запросов к OnlyMonster API (429 Too Many Requests). Попробуйте позже.";
    }

    return sendJson(res, 200, {
      success: false,
      error: friendlyMsg,
      status: response.status,
      details: parsed
    });
  } catch (err: any) {
    let errorMsg = `Ошибка сетевого подключения к OnlyMonster API: ${err.message}`;
    if (err.name === "AbortError") {
      errorMsg = "Превышено время ожидания ответа от OnlyMonster API (таймаут 10 секунд).";
    }
    return sendJson(res, 200, {
      success: false,
      error: errorMsg,
      status: err.name === "AbortError" ? 504 : 500,
      details: err.message
    });
  }
}
