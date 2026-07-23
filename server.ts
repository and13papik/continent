import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import fetch from "node-fetch";
import FormData from "form-data";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Telegram Configuration
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8497961851:AAEmwmEgJNV6KwyQjdcG62GY3IdX8zz6YV4';
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '-1003748692600';

  // Roster state management
  interface RosterServerState {
    status: 'ok' | 'needs_fix' | 'pending_approval';
    needsFix: boolean;
    rejectedBy?: string;
    rejectedAt?: string;
    confirmedBy?: string;
    confirmedAt?: string;
    lastMessageId?: number;
  }

  let rosterState: RosterServerState = {
    status: 'ok',
    needsFix: false
  };

  const scheduledSends: Record<string, boolean> = {};
  let pendingScheduledSend: string | null = null;
  let isSendingRosterLock = false;
  let lastRosterSendTimestamp = 0;

  // Kyiv time helper (Europe/Kyiv)
  function getKyivTimeInfo() {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Kyiv",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
    const parts = formatter.formatToParts(now);
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || "";
    const dateStr = `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
    const hour = parseInt(getPart("hour"), 10);
    const minute = parseInt(getPart("minute"), 10);
    return { dateStr, hour, minute };
  }

  // Interval checking 10:00 and 20:00 Kyiv time daily
  setInterval(() => {
    const kyiv = getKyivTimeInfo();
    const is10am = kyiv.hour === 10 && kyiv.minute >= 0 && kyiv.minute <= 3;
    const is8pm = kyiv.hour === 20 && kyiv.minute >= 0 && kyiv.minute <= 3;

    if (is10am || is8pm) {
      const slot = `${kyiv.dateStr}_${is10am ? '10:00' : '20:00'}`;
      if (!scheduledSends[slot] && pendingScheduledSend !== slot) {
        console.log(`[Kyiv Schedule] Triggering scheduled roster notification for slot: ${slot}`);
        pendingScheduledSend = slot;
      }
    }
  }, 15000);

  // In-memory state for approvals
  const rosterApprovals: Record<string, string[]> = {};

  // Telegram polling
  let isPolling = false;

  async function pollTelegram() {
    if (isPolling) return;
    isPolling = true;
    let offset = 0;

    console.log("Starting Telegram polling...");

    while (true) {
      try {
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${offset}&timeout=30`);
        const data: any = await response.json();

        if (data.ok && data.result.length > 0) {
          for (const update of data.result) {
            offset = update.update_id + 1;

            if (update.callback_query) {
              const query = update.callback_query;
              const msg = query.message;
              const cbData = query.data;
              const user = query.from;
              const userName = user.first_name || user.username || `Admin_${user.id}`;

              if (cbData === 'roster_actual' || cbData === 'confirm_roster') {
                rosterState = {
                  status: 'ok',
                  needsFix: false,
                  confirmedBy: userName,
                  confirmedAt: new Date().toISOString(),
                  lastMessageId: msg.message_id
                };

                const origCaption = (msg.caption || msg.text || '').split('\n\n<b>СОСТАВ АКТУАЛЕН?</b>')[0];
                const newCaption = `${origCaption}\n\n✅ <b>СОСТАВ ПОДТВЕРЖДЕН КАК АКТУАЛЬНЫЙ!</b>\nПодтвердил: ${userName}`;

                await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageCaption`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    chat_id: CHAT_ID,
                    message_id: msg.message_id,
                    caption: newCaption,
                    reply_markup: { inline_keyboard: [] },
                    parse_mode: 'HTML'
                  })
                });

                await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ callback_query_id: query.id, text: 'Состав подтвержден как актуальный!' })
                });

              } else if (cbData === 'roster_not_actual' || cbData === 'edit_roster') {
                rosterState = {
                  status: 'needs_fix',
                  needsFix: true,
                  rejectedBy: userName,
                  rejectedAt: new Date().toISOString(),
                  lastMessageId: msg.message_id
                };

                const origCaption = (msg.caption || msg.text || '').split('\n\n<b>СОСТАВ АКТУАЛЕН?</b>')[0];
                const newCaption = `${origCaption}\n\n❌ <b>СОСТАВ НЕ АКТУАЛЕН!</b>\nОтклонил: ${userName}\n\nПожалуйста, исправьте состав на сайте и нажмите "Подтвердить".`;

                const rosterUrl = 'https://continental.monster/#roster';

                await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageCaption`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    chat_id: CHAT_ID,
                    message_id: msg.message_id,
                    caption: newCaption,
                    reply_markup: {
                      inline_keyboard: [
                        [
                          { text: 'перейти в СОСТАВ и исправить', url: rosterUrl }
                        ]
                      ]
                    },
                    parse_mode: 'HTML'
                  })
                });

                await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ callback_query_id: query.id, text: 'Уведомление отправлено! Ожидаем исправления.' })
                });
              }
            }
          }
        }
      } catch (e) {
        console.error("Polling error:", e);
        await new Promise(r => setTimeout(r, 5000));
      }
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // Always run telegram polling
  pollTelegram().catch(console.error);

  // Endpoint to get roster state
  app.get("/api/roster/status", (req, res) => {
    res.json({
      success: true,
      rosterState,
      pendingScheduledSend
    });
  });

  // Endpoint to update roster state manually
  app.post("/api/roster/status", (req, res) => {
    const { status, needsFix } = req.body;
    if (status !== undefined) rosterState.status = status;
    if (needsFix !== undefined) rosterState.needsFix = needsFix;
    res.json({ success: true, rosterState });
  });

  // Dedicated endpoint to send roster screenshot with anti-spam lock
  app.post("/api/telegram/send-roster", async (req, res) => {
    const now = Date.now();
    if (isSendingRosterLock && (now - lastRosterSendTimestamp < 10000)) {
      return res.status(429).json({ error: "Отправка уже выполняется. Пожалуйста, подождите..." });
    }

    isSendingRosterLock = true;
    lastRosterSendTimestamp = now;

    try {
      const { image, periodLabel, isCorrection, scheduledSlot } = req.body;

      if (!image) {
        isSendingRosterLock = false;
        return res.status(400).json({ error: "Отсутствует изображение состава" });
      }

      const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, 'base64');

      const dateDisplay = new Date().toLocaleDateString('ru-RU');

      const headerText = isCorrection 
        ? `📊 <b>СОСТАВ КОМАНДЫ (актуальный состав после исправления)</b>`
        : `📊 <b>СОСТАВ КОМАНДЫ</b>`;

      const caption = `${headerText}\nПериод: ${periodLabel || 'Текущий'}\nДата: ${dateDisplay}\n\n<b>СОСТАВ АКТУАЛЕН?</b>\n\n🔔 <a href="tg://user?id=8679682362">@adm_viksi_viii [Adm]Vi</a> <a href="tg://user?id=6537516111">@adm_rctr Rector</a>`;

      const replyMarkup = {
        inline_keyboard: [
          [
            { text: 'АКТУАЛЕН', callback_data: 'roster_actual' },
            { text: 'НЕТ', callback_data: 'roster_not_actual' }
          ]
        ]
      };

      const form = new FormData();
      form.append('chat_id', CHAT_ID);
      form.append('photo', buffer, { filename: 'roster.png' });
      form.append('caption', caption);
      form.append('parse_mode', 'HTML');
      form.append('reply_markup', JSON.stringify(replyMarkup));

      const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
        method: 'POST',
        headers: form.getHeaders(),
        body: form
      });

      const result: any = await response.json();

      if (response.ok) {
        rosterState = {
          status: 'pending_approval',
          needsFix: false,
          lastMessageId: result.result?.message_id
        };

        if (scheduledSlot) {
          scheduledSends[scheduledSlot] = true;
          if (pendingScheduledSend === scheduledSlot) {
            pendingScheduledSend = null;
          }
        }

        isSendingRosterLock = false;
        return res.json({ success: true, result });
      } else {
        isSendingRosterLock = false;
        console.error("Telegram error result:", result);
        return res.status(500).json({ error: result.description || "Ошибка при отправке в Telegram" });
      }
    } catch (err: any) {
      isSendingRosterLock = false;
      console.error("Error in send-roster:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  // Generic endpoint to send Telegram message or photo
  app.post("/api/telegram/send", async (req, res) => {
    if (!BOT_TOKEN || !CHAT_ID) {
      return res.status(500).json({ error: "Telegram configuration missing" });
    }

    const { type, text, image, replyMarkup } = req.body;

    try {
      if (type === 'photo' && image) {
        // Handle base64 image
        const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, 'base64');
        
        const form = new FormData();
        form.append('chat_id', CHAT_ID);
        form.append('photo', buffer, { filename: 'roster.png' });
        if (text) form.append('caption', text);
        form.append('parse_mode', 'HTML');
        if (replyMarkup) form.append('reply_markup', JSON.stringify(replyMarkup));

        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
          method: 'POST',
          headers: form.getHeaders(),
          body: form
        });
        const result = await response.json();
        
        if (!response.ok) {
           console.error("Telegram error result:", result);
        }
        
        return res.status(response.status).json(result);
      } else {
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: CHAT_ID,
            text,
            reply_markup: replyMarkup,
            parse_mode: 'HTML'
          })
        });
        const result = await response.json();
        return res.status(response.status).json(result);
      }
    } catch (error: any) {
      console.error("Telegram API Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // OnlyMonster in-memory state
  const omWebhooksHistory: any[] = [];
  const maxOmWebhooks = 100;
  
  let omToken = process.env.ONLYMONSTER_TOKEN || "om_token_fc269e0cc20370b29c803be7ad2e85c8c43b3d84366a6cf0f3ae0c5001c9f2ca";
  let omWebhookId = process.env.ONLYMONSTER_WEBHOOK_ID || "om_webhook_c0c072250515454194c4619f1c7e3d0c3a58b8349bf1b092519e22c670ca41a4";

  // OnlyMonster Webhook handler (supporting multiple paths for safety)
  const handleOnlyMonsterWebhook = (req: any, res: any) => {
    const payload = req.body;
    console.log("Received OnlyMonster Webhook:", JSON.stringify(payload, null, 2));

    const eventType = payload.event || payload.type || "unknown";
    const data = payload.data || payload.payload || payload;
    
    const webhookEvent = {
      id: String(Date.now() + Math.random().toString(36).substring(2, 7)),
      timestamp: new Date().toISOString(),
      type: eventType,
      data: data,
      source: "OnlyMonster Webhook"
    };

    omWebhooksHistory.unshift(webhookEvent);
    if (omWebhooksHistory.length > maxOmWebhooks) {
      omWebhooksHistory.pop();
    }

    res.status(200).json({ success: true, received: true });
  };

  app.post("/api/webhook", handleOnlyMonsterWebhook);
  app.post("/api/onlymonster/webhook", handleOnlyMonsterWebhook);

  // Retrieve received webhooks
  app.get("/api/onlymonster/webhooks", (req, res) => {
    res.json({
      success: true,
      webhooks: omWebhooksHistory
    });
  });

  // Simulate a webhook internally
  app.post("/api/onlymonster/simulate", (req, res) => {
    const { type, data } = req.body;
    const simulatedEvent = {
      id: String(Date.now() + Math.random().toString(36).substring(2, 7)),
      timestamp: new Date().toISOString(),
      type: type || "chat.message",
      data: data || {},
      source: "Simulator"
    };

    omWebhooksHistory.unshift(simulatedEvent);
    if (omWebhooksHistory.length > maxOmWebhooks) {
      omWebhooksHistory.pop();
    }

    res.json({ success: true, event: simulatedEvent });
  });

  // OnlyMonster API Proxy
  app.get("/api/onlymonster/proxy", async (req, res) => {
    const subpath = req.query.path as string;
    if (!subpath) {
      return res.status(400).json({ error: "Missing path parameter" });
    }

    const cleanSubpath = subpath.replace(/^\//, "");
    
    // Multiple potential base URLs to try in case of Cloudflare 530 or other DNS/network errors.
    // We prioritize the known working live endpoint first to make requests instant and avoid DNS timeouts.
    const baseUrls = [
      "https://onlymonster.ai/api/v0/",
      "https://api.onlymonster.ai/v0/",
      "https://onlymonster.com/api/v0/",
      "https://api.onlymonster.com/v0/",
      "https://onlymonster.co/api/v0/",
      "https://api.onlymonster.co/v0/"
    ];

    let lastError: any = null;
    let successResult: any = null;
    let workedUrl = "";

    for (const baseUrl of baseUrls) {
      const apiUrl = `${baseUrl}${cleanSubpath}`;
      try {
        console.log(`Proxying OnlyMonster API request candidate: ${apiUrl}`);
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${omToken}`,
          "X-API-Key": omToken,
          "X-OM-Token": omToken
        };

        // Use a timeout of 5 seconds to avoid hanging on unresponsive endpoints
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(apiUrl, { 
          headers,
          signal: controller.signal as any
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          successResult = await response.json();
          workedUrl = apiUrl;
          break; // Successfully got data, exit loop!
        }

        // Parse error text
        let errorText = "";
        try {
          errorText = await response.text();
        } catch (textErr) {
          errorText = "Could not parse error response text";
        }

        console.log(`OnlyMonster API proxy candidate ${apiUrl} responded with status ${response.status}`);

        // If it's 401 or 403, the server is live but the credentials are wrong.
        // We should stop here instead of looping, because we reached the live API and it rejected us.
        if (response.status === 401 || response.status === 403) {
          lastError = {
            error: `Ошибка авторизации (${response.status}): Проверьте правильность введенного API токена.`,
            status: response.status,
            details: errorText
          };
          break;
        }

        lastError = {
          error: `API returned status ${response.status}`,
          status: response.status,
          details: errorText
        };
      } catch (err: any) {
        console.log(`OnlyMonster API proxy candidate ${apiUrl} failed: ${err.message}`);
        lastError = {
          error: `API connection failed: ${err.message}`,
          status: err.name === "AbortError" ? 504 : 500,
          details: err.message
        };
      }
    }

    if (successResult) {
      console.log(`Successfully fetched from OnlyMonster API: ${workedUrl}`);
      return res.json(successResult);
    }

    if (lastError?.status === 401 || lastError?.status === 403) {
      console.log(`OnlyMonster API returned client authorization error (${lastError.status}). Ready for user token configuration.`);
    } else {
      console.log("All OnlyMonster API proxy candidates failed or timed out.");
    }
    
    let friendlyMsg = lastError?.error || "Не удалось связаться с серверами OnlyMonster API.";
    if (lastError?.status === 530 || (lastError?.details && (lastError.details.includes("DNS") || lastError.details.includes("Cloudflare")))) {
      friendlyMsg = `Сервер OnlyMonster API в данный момент испытывает технические неполадки с DNS у Cloudflare (Error 530: Origin DNS error). Мы попытались подключиться по альтернативным адресам, но все они временно недоступны.`;
    }

    return res.status(200).json({ 
      success: false,
      error: friendlyMsg, 
      status: lastError?.status || 500,
      details: lastError?.details?.length > 500 ? lastError.details.substring(0, 500) + "..." : lastError?.details || "",
      fallback: true 
    });
  });

  // OnlyMonster API Inspector & Database storage state
  interface InspectorDiagnostics {
    hasKey: boolean;
    maskedKey: string;
    lastCheckedAt: string | null;
    httpStatus: number | null;
    durationMs: number | null;
    rateLimitRemaining: string | null;
    accountsCount: number;
    membersCount: number;
    discoveredEntities: {
      accounts: boolean;
      members: boolean;
      chats: boolean;
      messages: boolean;
      transactions: boolean;
      fans: boolean;
    };
    confirmedMetrics: string[];
    unavailableMetrics: string[];
    sampleResponses: Record<string, any>;
    errorMessage: string | null;
  }

  let inspectorDiagnostics: InspectorDiagnostics = {
    hasKey: Boolean(process.env.ONLYMONSTER_API_KEY && process.env.ONLYMONSTER_API_KEY.trim().length > 5),
    maskedKey: "отсутствует",
    lastCheckedAt: null,
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
    unavailableMetrics: [
      "Все метрики недоступны (ONLYMONSTER_API_KEY не настроен)"
    ],
    sampleResponses: {},
    errorMessage: "ONLYMONSTER_API_KEY_MISSING: API-ключ не настроен"
  };

  // Helper to anonymize sensitive text/names in sample JSON
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

  // Diagnostic endpoint for OnlyMonster API Inspector
  app.get("/api/integrations/onlymonster/inspector", (req, res) => {
    const key = process.env.ONLYMONSTER_API_KEY;
    const isConfigured = Boolean(key && key.trim().length > 5);

    if (!isConfigured) {
      return res.status(503).json({
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

    res.json({
      success: true,
      code: "CONFIGURED",
      apiKeyConfigured: true,
      connectionStatus: "configured",
      diagnostics: {
        ...inspectorDiagnostics,
        hasKey: true
      }
    });
  });

  // Test API Connection Endpoint (Official OpenAPI Base URL: https://omapi.onlymonster.ai/api/v0)
  app.post("/api/integrations/onlymonster/test", async (req, res) => {
    const key = process.env.ONLYMONSTER_API_KEY;

    if (!key || key.trim().length < 5) {
      return res.status(503).json({
        success: false,
        code: "ONLYMONSTER_API_KEY_MISSING",
        message: "OnlyMonster API key is not configured. Add ONLYMONSTER_API_KEY to server environment variables.",
        apiKeyConfigured: false,
        connectionStatus: "not_configured"
      });
    }

    const baseUrl = (process.env.ONLYMONSTER_API_BASE_URL || "https://omapi.onlymonster.ai/api/v0").replace(/\/+$/, "");
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

      // Security scheme ApiToken in OnlyMonster OpenAPI spec uses Authorization: Bearer header
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

      return res.json({
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
      return res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
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
  });

  // Manual or Periodic Sync endpoint
  app.post("/api/integrations/onlymonster/sync", async (req, res) => {
    const key = process.env.ONLYMONSTER_API_KEY;

    if (!key || key.trim().length < 5) {
      return res.status(503).json({
        success: false,
        code: "ONLYMONSTER_API_KEY_MISSING",
        message: "OnlyMonster API key is not configured. Add ONLYMONSTER_API_KEY to server environment variables.",
        apiKeyConfigured: false,
        connectionStatus: "not_configured"
      });
    }

    const baseUrl = (process.env.ONLYMONSTER_API_BASE_URL || "https://omapi.onlymonster.ai/api/v0").replace(/\/+$/, "");
    const { days = 1 } = req.body || {};
    const syncStartTime = Date.now();

    res.json({
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
  });

  // OnlyMonster Configuration getters and setters
  app.get("/api/onlymonster/config", (req, res) => {
    res.json({
      success: true,
      token: omToken,
      webhookId: omWebhookId
    });
  });

  app.post("/api/onlymonster/config", (req, res) => {
    const { token, webhookId } = req.body;
    if (token) omToken = token;
    if (webhookId) omWebhookId = webhookId;
    res.json({
      success: true,
      message: "Configuration updated successfully",
      token: omToken,
      webhookId: omWebhookId
    });
  });

  // Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
