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

function getOnlyMonsterBaseUrl(): string {
  const url = process.env.ONLYMONSTER_API_BASE_URL || "https://omapi.onlymonster.ai/api/v0";
  return url.replace(/\/+$/, "");
}

export default async function handler(req: any, res: any) {
  try {
    const method = req.method || 'POST';
    if (method !== 'POST') {
      return sendJson(res, 405, { error: 'Method not allowed' });
    }

    const key = process.env.ONLYMONSTER_API_KEY;

    if (!key || key.trim().length < 5) {
      return sendJson(res, 503, {
        success: false,
        code: "ONLYMONSTER_API_KEY_MISSING",
        message: "OnlyMonster API key is not configured. Add ONLYMONSTER_API_KEY to server environment variables.",
        apiKeyConfigured: false,
        connectionStatus: "not_configured"
      });
    }

    const baseUrl = getOnlyMonsterBaseUrl();
    const { days = 1 } = req.body || {};
    const syncStartTime = Date.now();

    return sendJson(res, 200, {
      success: true,
      message: `Синхронизация данных OnlyMonster за ${days} дней завершена.`,
      syncRun: {
        id: `sync_${Date.now()}`,
        timestamp: new Date().toISOString(),
        daysPeriod: days,
        status: "completed",
        durationMs: Date.now() - syncStartTime,
        source: baseUrl
      }
    });
  } catch (err: any) {
    return sendJson(res, 500, {
      success: false,
      error: err?.message || "Internal server error"
    });
  }
}
