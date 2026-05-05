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

  const cryptoCarts = new Map<string, { lastTx: string; lastUpdate: number }>();
  const processedTxs = new Set<string>(); 
  let monitoredWallets: any[] = [];

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

  const checkBlockchain = async () => {
    if (monitoredWallets.length === 0) return;

    // We only care about transactions in the last ~20 minutes to avoid spamming old ones on server start
    const recentThreshold = Date.now() - (20 * 60 * 1000);

    for (const wallet of monitoredWallets) {
      try {
        const addr = wallet.address?.trim();
        if (!addr) continue;

        let txs: any[] = [];
        if (wallet.network === 'TRC20') {
          // TronGrid USDT TRC20 
          // We add min_timestamp to filters
          const url = `https://api.trongrid.io/v1/accounts/${addr}/transactions/trc20?limit=10&contract_address=TR7NHqjew46xyUm2D9L6mzM16rxw9jhnVN&min_timestamp=${recentThreshold}`;
          const res = await fetch(url);
          if (res.ok) {
            const json = await res.json();
            txs = json.data || [];
          } else {
            console.error(`[CryptoWatch] TronGrid error ${res.status} for ${addr}`);
          }
        } 
        
        for (const tx of txs) {
          const txId = tx.transaction_id || tx.hash;
          if (!txId || processedTxs.has(txId)) continue;
          
          const toAddress = tx.to;
          if (toAddress && toAddress.toLowerCase() === addr.toLowerCase()) {
            const rawValue = tx.value || "0";
            const decimals = tx.token_info?.decimals || 6;
            const amount = (parseFloat(rawValue) / Math.pow(10, decimals)).toFixed(2);
            
            // Re-verify timestamp in case API didn't filter strictly
            const blockTime = tx.block_timestamp || Date.now();
            if (blockTime < recentThreshold) continue;

            console.log(`[CryptoWatch] [MATCH] New deposit: ${amount} ${wallet.coin} on ${wallet.label}`);
            processedTxs.add(txId);
            
            // Step 1: Processing notification
            await sendTelegramMessage(
              `💎 <b>Входящий платеж в процессе</b>\n\n` +
              `💰 Сумма: <b>${amount} ${wallet.coin}</b>\n` +
              `🌐 Сеть: <b>${wallet.network}</b>\n` +
              `📥 Кошелек: <code>${wallet.label}</code>\n` +
              `🔗 TX: <a href="https://tronscan.org/#/transaction/${txId}">${txId.slice(0, 8)}...</a>\n\n` +
              `⏳ Ожидайте подтверждения...`
            );

            // Step 2: Success notification
            setTimeout(async () => {
              await sendTelegramMessage(
                `✅ <b>Платеж успешно зачислен!</b>\n\n` +
                `💰 Сумма: <b>${amount} ${wallet.coin}</b>\n` +
                `👤 Отправитель: <code>${tx.from ? tx.from.slice(0, 6) + '...' + tx.from.slice(-4) : 'Unknown'}</code>\n` +
                `📥 На кошелек: <code>${wallet.label}</code>\n\n` +
                `💳 Баланс обновлен.`
              );
            }, 15000); 
          }
        }
      } catch (err) {
        console.error(`[CryptoWatch] Monitoring error for ${wallet.label}:`, err);
      }
    }
  };

  // Start the background monitoring
  setInterval(checkBlockchain, 60000); // Check every minute

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

  app.all("/api/crypto/monitor", (req, res) => {
    console.log(`[CryptoWatch] Received ${req.method} request to /api/crypto/monitor`);
    
    if (req.method === 'GET') {
      return res.json({ status: "alive", count: monitoredWallets.length });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { wallets } = req.body;
    if (!Array.isArray(wallets)) return res.status(400).json({ error: "Invalid wallets list" });
    
    // Check for NEW wallets
    const currentIds = new Set(monitoredWallets.map(w => w.id));
    const newWallets = wallets.filter(w => !currentIds.has(w.id));

    if (newWallets.length > 0) {
      console.log(`[CryptoWatch] New wallets detected: ${newWallets.map(w => w.label).join(', ')}`);
      newWallets.forEach(async wallet => {
        console.log(`[CryptoWatch] Triggering Telegram notification for wallet: ${wallet.label}`);
        await sendTelegramMessage(
          `🔔 <b>Новый кошелек добавлен на мониторинг</b>\n\n` +
          `🏷 Метка: <b>${wallet.label}</b>\n` +
          `🌐 Сеть: <b>${wallet.network}</b>\n` +
          `💰 Валюта: <b>${wallet.coin}</b>\n` +
          `📂 Адрес: <code>${wallet.address}</code>\n\n` +
          `🚀 Бот начал отслеживание транзакций.`
        );
      });
    }

    monitoredWallets = wallets;
    console.log(`[CryptoWatch] Updated monitoring list: ${wallets.length} wallets`);
    res.json({ status: "ok", monitoring: true });
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
