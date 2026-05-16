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
        if (replyMarkup) form.append('reply_markup', JSON.stringify(replyMarkup));

        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
          method: 'POST',
          body: form
        });
        const result = await response.json();
        return res.json(result);
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
        return res.json(result);
      }
    } catch (error: any) {
      console.error("Telegram API Error:", error);
      res.status(500).json({ error: error.message });
    }
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
