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
  app.use(express.json());

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
      // We'll use express.json() but reports might be large.
      // However, usually we can just proxy the request to Telegram.
      // For simplicity, let's just forward the body if it's already a multipart form
      // or handle it as a JSON if the frontend sends base64 (not recommended for large files)
      
      // Let's use express-fileupload or similar if needed, but we can also just
      // receive base64 if it's not too big. 
      // Actually, let's just proxy the multipart request.
      
      // Since we don't have a multipart parser easily available without installing, 
      // let's just have the frontend call Telegram directly for now BUT fix the html2canvas issue.
      // Wait, if I want to keep it secure, I SHOULD move the token.
      
      res.status(501).json({ error: "Use client-side sending for now; logic check pending." });
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
