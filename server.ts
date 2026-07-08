import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import fetch from "node-fetch";
import FormData from "form-data";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // Telegram Configuration
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8497961851:AAEmwmEgJNV6KwyQjdcG62GY3IdX8zz6YV4';
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '-1003748692600';

  // In-memory state for approvals (in a real app, this should be in DB)
  const rosterApprovals: Record<string, string[]> = {};

  // Terminal state for polling
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
              const data = query.data;
              const user = query.from;
              const userName = user.first_name || user.username || `User_${user.id}`;

              if (data === 'confirm_roster') {
                const msgId = msg.message_id.toString();
                if (!rosterApprovals[msgId]) rosterApprovals[msgId] = [];
                
                if (!rosterApprovals[msgId].includes(userName)) {
                  rosterApprovals[msgId].push(userName);
                }

                const count = rosterApprovals[msgId].length;
                let newText = msg.caption || msg.text || '';
                let newMarkup = msg.reply_markup;

                if (count >= 2) {
                  newText += `\n\n✅ <b>СОСТАВ ПОДТВЕРЖДЕН!</b>\nПодтвердили: ${rosterApprovals[msgId].join(', ')}`;
                  newMarkup = { inline_keyboard: [] };
                } else {
                  newMarkup.inline_keyboard[0][0].text = `✅ АКТУАЛЬНО (${count}/2)`;
                }

                await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessage${msg.photo ? 'Caption' : 'Text'}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    chat_id: CHAT_ID,
                    message_id: msg.message_id,
                    [msg.photo ? 'caption' : 'text']: newText,
                    reply_markup: newMarkup,
                    parse_mode: 'HTML'
                  })
                });

                await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ callback_query_id: query.id, text: `Ваш голос учтен: ${userName}` })
                });
              } else if (data === 'edit_roster') {
                await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    chat_id: CHAT_ID,
                    text: `⚠️ <b>ТРЕБУЕТСЯ КОРРЕКТИРОВКА СОСТАВА</b>\nОтправил: ${userName}`,
                    parse_mode: 'HTML'
                  })
                });
                
                await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ callback_query_id: query.id, text: 'Уведомление отправлено!' })
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

  if (process.env.NODE_ENV !== "production") {
    pollTelegram().catch(console.error);
  }

  // Endpoint to send Telegram message or photo
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
