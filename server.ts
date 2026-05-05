import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  console.log("[Server] Initializing startServer...");
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

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

  const TG_BOT_TOKEN = "8497961851:AAEmwmEgJNV6KwyQjdcG62GY3IdX8zz6YV4";
  const TG_CHAT_ID = "-1003748692600";

  // Helper for generic caching
  const getCachedOrFetch = async (key: string, fetchFn: () => Promise<any>, ttl = CACHE_TTL) => {
    const cached = genericCache.get(key);
    if (cached && cached.expiry > Date.now()) return cached.data;
    const data = await fetchFn();
    genericCache.set(key, { data, expiry: Date.now() + ttl });
    return data;
  };

  // Helper for exponential backoff retry with timeout
  async function fetchWithRetry(url: string, options: any, retries = 3, backoff = 1000): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); 

    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      if (response.ok) return response;
      if (retries > 0 && (response.status >= 500 || response.status === 429)) {
        await new Promise(resolve => setTimeout(resolve, backoff));
        return fetchWithRetry(url, options, retries - 1, backoff * 2);
      }
      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, backoff));
        return fetchWithRetry(url, options, retries - 1, backoff * 2);
      }
      throw error;
    }
  }

  const sendTelegramMessage = async (text: string) => {
    try {
      console.log(`[Telegram] Sending message to ${TG_CHAT_ID}...`);
      const resp = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TG_CHAT_ID, text, parse_mode: 'HTML' })
      });
      
      const data: any = await resp.json();
      if (!resp.ok) {
        console.error(`[Telegram] API Error Response:`, JSON.stringify(data));
        return { success: false, error: data.description || "Unknown Telegram error" };
      } else {
        console.log(`[Telegram] Message sent successfully. ID: ${data.result?.message_id}`);
        return { success: true };
      }
    } catch (err: any) {
      console.error(`[Telegram] Network Error:`, err);
      return { success: false, error: err.message };
    }
  };

  // Endpoint for sending reports from the frontend (with images)
  app.post("/api/send-report", async (req, res) => {
    try {
      const { image, caption, chatId } = req.body;
      
      if (!image) return res.status(400).json({ error: "Image data is required" });
      
      console.log(`[Telegram] Sending report image to ${chatId || TG_CHAT_ID}...`);
      
      // The image is base64 data URL from html-to-image
      const base64Data = image.replace(/^data:image\/png;base64,/, "");
      const buffer = Buffer.from(base64Data, 'base64');
      
      const formData = new FormData();
      formData.append('chat_id', chatId || TG_CHAT_ID);
      const blob = new Blob([buffer], { type: 'image/png' });
      formData.append('photo', blob, 'report.png');
      formData.append('caption', caption || "");
      formData.append('parse_mode', 'HTML');
      
      const resp = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendPhoto`, {
        method: 'POST',
        body: formData
      });
      
      const data: any = await resp.json();
      if (!resp.ok) {
        console.error(`[Telegram] API Error:`, data);
        return res.status(resp.status).json({ error: data.description || "Telegram API error" });
      }
      
      res.json({ success: true, messageId: data.result?.message_id });
    } catch (err: any) {
      console.error(`[Server] Report error:`, err);
      res.status(500).json({ error: err.message });
    }
  });

  // Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  app.all("/api/test-telegram", async (req, res) => {
    console.log(`[Server] Handling /api/test-telegram request...`);
    const result = await sendTelegramMessage("🔔 <b>Тестовое сообщение</b>\nБот успешно подключен к серверу!");
    if (result.success) {
      res.json({ status: "sent", message: "Check your Telegram group" });
    } else {
      res.status(500).json({ status: "error", error: result.error });
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
