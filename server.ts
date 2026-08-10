import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import fetch from "node-fetch";
import FormData from "form-data";
import {
  handleOnlyMonsterInspector,
  handleOnlyMonsterTest,
  handleOnlyMonsterSync
} from "./api/_lib/onlymonster-client.js";
import onlyMonsterConfigHandler from "./api/onlymonster/config.js";
import onlyMonsterProxyHandler from "./api/onlymonster/proxy.js";
import onlyMonsterEarningsHandler from "./api/onlymonster/earnings.js";
import onlyMonsterShiftOperatorsHandler from "./api/onlymonster/shift-operators.js";
import onlyMonsterShiftComparisonHandler from "./api/onlymonster/shift-comparison.js";
import onlyMonsterOperatorModelBreakdownHandler from "./api/onlymonster/operator-model-breakdown.js";
import onlyMonsterAccountDetailHandler from "./api/onlymonster/account-detail.js";

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
  let lastRosterImageData: { image: string; periodLabel: string; isCorrection: boolean } | null = null;

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

  // Interval checking 10:00 and 22:00 Kyiv time daily for automated Telegram send
  setInterval(async () => {
    const kyiv = getKyivTimeInfo();
    const is10am = kyiv.hour === 10 && kyiv.minute >= 0 && kyiv.minute <= 3;
    const is10pm = kyiv.hour === 22 && kyiv.minute >= 0 && kyiv.minute <= 3;

    if (is10am || is10pm) {
      const timeTag = is10am ? '10:00' : '22:00';
      const slot = `${kyiv.dateStr}_${timeTag}`;
      if (!scheduledSends[slot] && pendingScheduledSend !== slot) {
        console.log(`[Kyiv Schedule] Triggering scheduled roster notification for slot: ${slot}`);
        pendingScheduledSend = slot;
      }

      // Fallback: Only after 3 minutes if client hasn't sent AND ONLY IF cached image exists (NEVER send text-only)
      if (pendingScheduledSend === slot && kyiv.minute >= 3 && !scheduledSends[slot] && !isSendingRosterLock && lastRosterImageData?.image) {
        console.log(`[Kyiv Schedule Fallback] Server auto-sending cached roster photo for slot: ${slot}`);
        scheduledSends[slot] = true;
        pendingScheduledSend = null;
        isSendingRosterLock = true;

        try {
          const dateDisplay = new Date().toLocaleDateString('ru-RU');
          const headerText = `📊 <b>СОСТАВ КОМАНДЫ</b>`;
          const caption = `${headerText}\nПериод: ${lastRosterImageData.periodLabel || 'Текущий'}\nДата: ${dateDisplay}\n\n<b>СОСТАВ АКТУАЛЕН?</b>\n\n🔔 <a href="tg://user?id=8679682362">@adm_viksi_viii [Adm]Vi</a> <a href="tg://user?id=6537516111">@adm_rctr Rector</a>`;

          const replyMarkup = {
            inline_keyboard: [
              [
                { text: 'АКТУАЛЕН', callback_data: 'roster_actual' },
                { text: 'НЕТ', callback_data: 'roster_not_actual' }
              ]
            ]
          };

          const base64Data = lastRosterImageData.image.replace(/^data:image\/\w+;base64,/, "");
          const buffer = Buffer.from(base64Data, 'base64');
          const form = new FormData();
          form.append('chat_id', CHAT_ID);
          form.append('photo', buffer, { filename: 'roster.png' });
          form.append('caption', caption);
          form.append('parse_mode', 'HTML');
          form.append('reply_markup', JSON.stringify(replyMarkup));

          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
            method: 'POST',
            headers: form.getHeaders(),
            body: form
          });

          rosterState = {
            status: 'pending_approval',
            needsFix: false
          };
        } catch (autoErr) {
          console.error("Error in server auto-send fallback:", autoErr);
        } finally {
          isSendingRosterLock = false;
        }
      }
    }
  }, 10000);

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

      if (scheduledSlot) {
        scheduledSends[scheduledSlot] = true;
        if (pendingScheduledSend === scheduledSlot) {
          pendingScheduledSend = null;
        }
      }

      if (!image) {
        isSendingRosterLock = false;
        return res.status(400).json({ error: "Отсутствует изображение состава" });
      }

      // Cache image for automated server fallback sends
      lastRosterImageData = {
        image,
        periodLabel: periodLabel || 'Текущий',
        isCorrection: !!isCorrection
      };

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
  app.get("/api/onlymonster/proxy", (req, res) => onlyMonsterProxyHandler(req, res));

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
    const result = handleOnlyMonsterInspector();
    res.status(result.statusCode).json(result.body);
  });

  // Test API Connection Endpoint (Official OpenAPI Base URL: https://omapi.onlymonster.ai/api/v0)
  app.post("/api/integrations/onlymonster/test", async (req, res) => {
    const result = await handleOnlyMonsterTest();
    res.status(result.statusCode).json(result.body);
  });

  // Manual or Periodic Sync endpoint
  app.post("/api/integrations/onlymonster/sync", async (req, res) => {
    const result = await handleOnlyMonsterSync(req.body);
    res.status(result.statusCode).json(result.body);
  });

  // OnlyMonster Configuration, proxy, earnings, shift-operators, shift-comparison, operator-model-breakdown, and account-detail handlers
  app.all("/api/onlymonster/config", (req, res) => onlyMonsterConfigHandler(req, res));
  app.all("/api/onlymonster/proxy", (req, res) => onlyMonsterProxyHandler(req, res));
  app.all("/api/onlymonster/earnings", (req, res) => onlyMonsterEarningsHandler(req, res));
  app.all("/api/onlymonster/shift-operators", (req, res) => onlyMonsterShiftOperatorsHandler(req, res));
  app.all("/api/onlymonster/shift-comparison", (req, res) => onlyMonsterShiftComparisonHandler(req, res));
  app.all("/api/onlymonster/operator-model-breakdown", (req, res) => onlyMonsterOperatorModelBreakdownHandler(req, res));
  app.all("/api/onlymonster/account-detail", (req, res) => onlyMonsterAccountDetailHandler(req, res));

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
