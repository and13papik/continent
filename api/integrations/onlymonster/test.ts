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

function sanitizeSampleJSON(obj: any): any {
  if (!obj) return obj;
  if (typeof obj === 'string') {
    if (obj.length > 30) return `${obj.substring(0, 10)}...[MASKED]`;
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.slice(0, 2).map(sanitizeSampleJSON);
  }
  if (typeof obj === 'object') {
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (key.includes('token') || key.includes('key') || key.includes('password') || key.includes('secret')) {
        sanitized[key] = "********";
      } else if (key === 'email' || key === 'fan_name' || key === 'name' || key === 'text') {
        sanitized[key] = typeof value === 'string' ? `${value.substring(0, 2)}***` : value;
      } else {
        sanitized[key] = sanitizeSampleJSON(value);
      }
    }
    return sanitized;
  }
  return obj;
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
    const officialUrl = `${baseUrl}/accounts`;
    const startTime = Date.now();
    let statusCode = 500;
    let rateLimitRem = "0";
    let sampleData: any = null;
    let errorDetails = "";
    let testSuccess = false;
    let contentType = "";

    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 8000);

      const apiRes = await fetch(officialUrl, {
        headers: {
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        signal: controller.signal as any
      });
      clearTimeout(tid);

      statusCode = apiRes.status;
      contentType = apiRes.headers.get("content-type") || "";
      rateLimitRem = apiRes.headers.get("x-ratelimit-remaining") || apiRes.headers.get("ratelimit-remaining") || "0";

      if (apiRes.ok) {
        sampleData = await apiRes.json();
        testSuccess = true;
      } else {
        errorDetails = await apiRes.text().catch(() => "");
      }
    } catch (err: any) {
      errorDetails = err.message;
    }

    const duration = Date.now() - startTime;

    if (testSuccess) {
      const accList = Array.isArray(sampleData) ? sampleData : (sampleData?.data || []);
      const maskedAccounts = accList.map((acc: any) => ({
        id: acc.id ? `${acc.id.toString().substring(0, 3)}***` : "acc***",
        name: acc.name ? `${acc.name.toString().substring(0, 2)}***` : "mo***"
      }));

      const rawSampleAccount = accList.length > 0 ? sanitizeSampleJSON(accList[0]) : null;

      return sendJson(res, 200, {
        success: true,
        code: "TEST_SUCCESSFUL",
        connectionStatus: "live",
        apiKeyConfigured: true,
        httpStatus: statusCode,
        durationMs: duration,
        timestamp: new Date().toISOString(),
        finalUrl: officialUrl,
        authHeaderName: "Authorization: Bearer <token>",
        contentType,
        accountsFound: accList.length,
        maskedAccounts,
        rawSampleAccount,
        rateLimitRemaining: rateLimitRem
      });
    } else {
      const resStatus = statusCode >= 400 && statusCode < 600 ? statusCode : 500;
      return sendJson(res, resStatus, {
        success: false,
        code: "API_CONNECTION_FAILED",
        connectionStatus: "error",
        apiKeyConfigured: true,
        httpStatus: statusCode,
        finalUrl: officialUrl,
        authHeaderName: "Authorization: Bearer <token>",
        contentType,
        error: `OnlyMonster API status ${statusCode}: ${errorDetails || "Request failed"}`,
        rawErrorDetails: errorDetails.substring(0, 1000),
        durationMs: duration,
        timestamp: new Date().toISOString()
      });
    }
  } catch (err: any) {
    return sendJson(res, 500, {
      success: false,
      error: err?.message || "Internal server error"
    });
  }
}
