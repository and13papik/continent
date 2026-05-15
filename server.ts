import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import FormData from 'form-data';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  console.log("[Server] Initializing startServer...");
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ limit: '20mb', extended: true }));

  // Request logging middleware
  app.use((req, res, next) => {
    console.log(`[Server] ${req.method} ${req.url}`);
    next();
  });

  // --- State & Cache ---
  const processedSessions = new Set<string>();
  const genericCache = new Map<string, { data: any; expiry: number }>();
  const CACHE_TTL = 60000; 
  let lastRequestTime = 0;
  const MIN_REQUEST_INTERVAL = 1000 / 15;

  const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN || "8497961851:AAEmwmEgJNV6KwyQjdcG62GY3IdX8zz6YV4";
  const TG_CHAT_ID = process.env.TG_CHAT_ID || "-1003748692600";

  // Helper for Telegram API requests
  async function callTelegramAPI(method: string, body: any, isFormData = false) {
    const url = `https://api.telegram.org/bot${TG_BOT_TOKEN}/${method}`;
    const options: any = {
      method: "POST",
    };

    if (isFormData) {
      options.body = body;
      options.headers = body.getHeaders();
    } else {
      options.headers = { "Content-Type": "application/json" };
      options.body = JSON.stringify(body);
    }

    try {
      const resp = await fetch(url, options);
      const data: any = await resp.json();
      if (!resp.ok) {
        console.error(`[Telegram] API ${method} Error:`, data);
        return { success: false, status: resp.status, error: data.description || `Telegram error ${resp.status}` };
      }
      return { success: true, result: data.result };
    } catch (err: any) {
      console.error(`[Telegram] Network Error:`, err);
      return { success: false, status: 500, error: err.message };
    }
  }

  // Helper for generic caching
  const getCachedOrFetch = async (key: string, fetchFn: () => Promise<any>, ttl = CACHE_TTL) => {
    const cached = genericCache.get(key);
    if (cached && cached.expiry > Date.now()) return cached.data;
    const data = await fetchFn();
    genericCache.set(key, { data, expiry: Date.now() + ttl });
    return data;
  };

  // Endpoint for sending reports from the frontend (with images)
  app.post("/api/send-report", async (req, res) => {
    try {
      const { image, caption, chatId } = req.body;
      const payloadSize = JSON.stringify(req.body).length;
      console.log(`[Server] Received /api/send-report (Size: ${(payloadSize / 1024).toFixed(1)} KB)`);
      
      if (!image) return res.status(400).json({ error: "Image data is required" });
      
      const targetChatId = chatId || TG_CHAT_ID;
      console.log(`[Telegram] Sending report image to ${targetChatId}...`);
      
      const matches = image.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) return res.status(400).json({ error: "Invalid image format" });
      
      const mimeType = matches[1];
      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, 'base64');
      
      const form = new FormData();
      form.append('chat_id', targetChatId);
      form.append('photo', buffer, { 
        filename: `report.${mimeType.split('/')[1] || 'jpg'}`, 
        contentType: mimeType 
      });
      form.append('caption', caption || "");
      form.append('parse_mode', 'HTML');
      
      const result = await callTelegramAPI("sendPhoto", form, true);
      
      if (!result.success) {
        return res.status(result.status || 500).json({ error: result.error });
      }
      
      console.log(`[Telegram] Report sent successfully. ID: ${result.result?.message_id}`);
      res.json({ success: true, messageId: result.result?.message_id });
    } catch (err: any) {
      console.error(`[Server] Report error:`, err);
      res.status(500).json({ error: err.message });
    }
  });

  // Endpoint for advance requests
  app.post("/api/send-advance-request", async (req, res) => {
    try {
      const { message, reply_markup } = req.body;
      console.log(`[Telegram] Sending advance request...`);
      
      const result = await callTelegramAPI("sendMessage", {
        chat_id: TG_CHAT_ID,
        text: message,
        parse_mode: 'HTML',
        reply_markup
      });
      
      if (!result.success) {
        return res.status(result.status || 500).json({ error: result.error });
      }
      
      res.json({ success: true, result: result.result });
    } catch (err: any) {
      console.error(`[Server] Advance request error:`, err);
      res.status(500).json({ error: err.message });
    }
  });

  // Endpoint for marking as paid (editing message)
  app.post("/api/edit-telegram-message", async (req, res) => {
    try {
      const { messageId, text } = req.body;
      console.log(`[Telegram] Editing message ${messageId}...`);
      
      const result = await callTelegramAPI("editMessageText", {
        chat_id: TG_CHAT_ID,
        message_id: messageId,
        text,
        parse_mode: 'HTML'
      });
      
      if (!result.success) {
        return res.status(result.status || 500).json({ error: result.error });
      }
      
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  app.all("/api/test-telegram", async (req, res) => {
    console.log(`[Server] Handling /api/test-telegram request...`);
    const result = await callTelegramAPI("sendMessage", {
      chat_id: TG_CHAT_ID,
      text: "🔔 <b>Тестовое сообщение</b>\nБот успешно подключен к серверу!",
      parse_mode: 'HTML'
    });
    
    if (result.success) {
      res.json({ status: "sent", message: "Check your Telegram group" });
    } else {
      res.status(result.status || 500).json({ status: "error", error: result.error });
    }
  });

  // Final API 404 handler - MUST come before static/vite
  app.all("/api/*", (req, res) => {
    console.warn(`[Server] [404] API route not found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ 
      error: "API Route not found", 
      method: req.method, 
      url: req.originalUrl,
      suggestion: "If you just deployed, wait a few seconds for the server to start."
    });
  });

  // --- Vite / Static Assets ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
