import { getOmToken, setOmToken, getOmWebhookId, setOmWebhookId, isKvConfigured } from '../_lib/om-store.js';

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
  const kvActive = isKvConfigured();

  if (method === 'GET') {
    const activeKey = await getOmToken();
    const isCustomKey = Boolean(activeKey && activeKey.length > 5 && !activeKey.startsWith("om_token_fc269e0"));
    const webhookId = await getOmWebhookId();
    return sendJson(res, 200, {
      success: true,
      token: activeKey,
      apiKeyConfigured: isCustomKey,
      webhookId,
      kvAvailable: kvActive
    });
  }

  if (method === 'POST') {
    let body = req.body || {};
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        body = {};
      }
    }
    const { token, apiKey, webhookId } = body;
    const keyToUse = (token || apiKey || "").trim();
    if (keyToUse) {
      await setOmToken(keyToUse);
    }
    if (webhookId) {
      await setOmWebhookId(webhookId);
    }
    const currentKey = await getOmToken();
    const currentWebhookId = await getOmWebhookId();

    return sendJson(res, 200, {
      success: true,
      message: kvActive 
        ? "Конфигурация OnlyMonster успешно сохранена в Vercel KV" 
        : "Конфигурация обновлена в текущем инстансе",
      token: currentKey,
      apiKeyConfigured: Boolean(currentKey && currentKey.length > 5 && !currentKey.startsWith("om_token_fc269e0")),
      webhookId: currentWebhookId,
      kvAvailable: kvActive
    });
  }

  return sendJson(res, 405, { error: "Method not allowed" });
}
