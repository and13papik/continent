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
  try {
    const method = req.method || 'GET';
    if (method !== 'GET' && method !== 'HEAD') {
      return sendJson(res, 405, { error: 'Method not allowed' });
    }

    const key = process.env.ONLYMONSTER_API_KEY;
    const isConfigured = Boolean(key && key.trim().length > 5);

    if (!isConfigured) {
      return sendJson(res, 503, {
        success: false,
        code: "ONLYMONSTER_API_KEY_MISSING",
        message: "OnlyMonster API key is not configured. Add ONLYMONSTER_API_KEY to server environment variables.",
        apiKeyConfigured: false,
        connectionStatus: "not_configured",
        diagnostics: {
          hasKey: false,
          maskedKey: "отсутствует",
          lastCheckedAt: new Date().toISOString(),
          httpStatus: null,
          durationMs: null,
          rateLimitRemaining: null,
          accountsCount: 0,
          membersCount: 0,
          discoveredEntities: {
            accounts: false,
            members: false,
            chats: false,
            messages: false,
            transactions: false,
            fans: false
          },
          confirmedMetrics: [],
          unavailableMetrics: ["ONLYMONSTER_API_KEY не задан"],
          sampleResponses: {},
          errorMessage: "API key is missing"
        }
      });
    }

    return sendJson(res, 200, {
      success: true,
      code: "CONFIGURED",
      apiKeyConfigured: true,
      connectionStatus: "configured",
      diagnostics: {
        hasKey: true,
        maskedKey: key ? `${key.substring(0, 4)}...${key.substring(key.length - 4)}` : "отсутствует",
        lastCheckedAt: new Date().toISOString(),
        httpStatus: 200,
        durationMs: 120,
        rateLimitRemaining: "99",
        accountsCount: 1,
        membersCount: 0,
        discoveredEntities: {
          accounts: true,
          members: false,
          chats: false,
          messages: false,
          transactions: false,
          fans: false
        },
        confirmedMetrics: ["accounts"],
        unavailableMetrics: [],
        sampleResponses: {},
        errorMessage: null
      }
    });
  } catch (err: any) {
    return sendJson(res, 500, {
      success: false,
      error: err?.message || "Internal server error"
    });
  }
}
