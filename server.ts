import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // OnlyMonster Configuration
  const OM_API_TOKEN = process.env.OM_API_TOKEN || "om_token_afcb309585034d799a891a4d8a7d2827529c2873f59ac69b292b155e5442442d";
  const OM_WEBHOOK_SECRET = process.env.OM_WEBHOOK_SECRET || "om_webhook_99ff5707ade5e23dae520a663a8f9ac88272c761e4f2a130939c30160cd33222";
  const ONLYMONSTER_API_BASE = "https://omapi.onlymonster.ai";

  // --- State & Cache ---
  const processedSessions = new Set<string>();
  const metricsCache = new Map<string, { data: any; expiry: number }>();
  const genericCache = new Map<string, { data: any; expiry: number }>();
  const CACHE_TTL = 60000; 
  let lastRequestTime = 0;
  const MIN_REQUEST_INTERVAL = 1000 / 15;

  const cryptoCarts = new Map<string, { lastTx: string; lastUpdate: number }>();
  const processedTxs = new Set<string>(); 
  let monitoredWallets: any[] = [];

  const TG_BOT_TOKEN = "8620136598:AAFBdcVr9xoRjUWFQ3DtG5ka4zM_Jh4Rg08";
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
      await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TG_CHAT_ID, text, parse_mode: 'HTML' })
      });
    } catch (err) {
      console.error(`[Telegram] Error:`, err);
    }
  };

  const checkBlockchain = async () => {
    if (monitoredWallets.length === 0) {
      return;
    }

    console.log(`[CryptoWatch] Checking ${monitoredWallets.length} wallets...`);

    for (const wallet of monitoredWallets) {
      try {
        const addr = wallet.address?.trim();
        if (!addr) continue;

        let txs: any[] = [];
        if (wallet.network === 'TRC20') {
          // TronGrid USDT TRC20
          const url = `https://api.trongrid.io/v1/accounts/${addr}/transactions/trc20?limit=5&contract_address=TR7NHqjew46xyUm2D9L6mzM16rxw9jhnVN`;
          const res = await fetch(url);
          if (res.ok) {
            const json = await res.json();
            txs = json.data || [];
            if (json.success === false) {
              console.error(`[CryptoWatch] TronGrid API returned success:false for ${addr}`);
            }
          } else {
            console.error(`[CryptoWatch] TronGrid API error ${res.status} for ${addr}`);
          }
        } 
        
        if (txs.length > 0) {
          console.log(`[CryptoWatch] Found ${txs.length} recent TXs for ${wallet.label} (${addr})`);
        }
        
        for (const tx of txs) {
          const txId = tx.transaction_id || tx.hash;
          if (!txId || processedTxs.has(txId)) continue;
          
          // Check if it's a deposit (to this wallet)
          const toAddress = tx.to;
          const isMatch = toAddress && toAddress.toLowerCase() === addr.toLowerCase();
          
          if (isMatch) {
            const rawValue = tx.value || "0";
            const decimals = tx.token_info?.decimals || 6;
            const amount = (parseFloat(rawValue) / Math.pow(10, decimals)).toFixed(2);
            
            console.log(`[CryptoWatch] [MATCH] New transaction detected: ${txId} for ${amount} ${wallet.coin}`);
            processedTxs.add(txId);
            
            // Initial Notification
            await sendTelegramMessage(
              `💎 <b>Входящий платеж в процессе</b>\n\n` +
              `💰 Сумма: <b>${amount} ${wallet.coin}</b>\n` +
              `🌐 Сеть: <b>${wallet.network}</b>\n` +
              `📥 Кошелек: <code>${wallet.label}</code>\n` +
              `🔗 TX: <a href="https://tronscan.org/#/transaction/${txId}">${txId.slice(0, 8)}...</a>\n\n` +
              `⏳ Ожидайте подтверждения...`
            );

            // Simulate "Successful" notification after a short delay
            setTimeout(async () => {
              await sendTelegramMessage(
                `✅ <b>Платеж успешно зачислен!</b>\n\n` +
                `💰 Сумма: <b>${amount} ${wallet.coin}</b>\n` +
                `👤 Отправитель: <code>${tx.from ? tx.from.slice(0, 6) + '...' + tx.from.slice(-4) : 'Unknown'}</code>\n` +
                `📥 На кошелек: <code>${wallet.label}</code>\n\n` +
                `💳 Баланс обновлен.`
              );
            }, 30000); // 30s instead of 60s
          }
        }
      } catch (err) {
        console.error(`[CryptoWatch] Error checking ${wallet.network} for ${wallet.label}:`, err);
      }
    }
  };

  // Start the background monitoring
  setInterval(checkBlockchain, 60000); // Check every minute

  app.post("/api/crypto/monitor", (req, res) => {
    const { wallets } = req.body;
    if (!Array.isArray(wallets)) return res.status(400).json({ error: "Invalid wallets list" });
    monitoredWallets = wallets;
    console.log(`[CryptoWatch] Updated monitoring list: ${wallets.length} wallets`);
    res.json({ status: "ok", monitoring: true });
  });

  // 1. Production Metrics Endpoint
  app.get("/api/metrics", async (req, res) => {
    try {
      const { from, to, offset = "0", limit = "100", creator_ids } = req.query;

      if (!from || !to) {
        return res.status(400).json({ error: "Query parameters 'from' and 'to' (ISO 8601) are required." });
      }

      const cacheKey = `metrics-${from}-${to}-${offset}-${limit}-${creator_ids || 'all'}`;
      
      const cached = metricsCache.get(cacheKey);
      if (cached && cached.expiry > Date.now()) {
        return res.json(cached.data);
      }

      const now = Date.now();
      const waitTime = Math.max(0, MIN_REQUEST_INTERVAL - (now - lastRequestTime));
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      lastRequestTime = Date.now();

      const params = new URLSearchParams({
        from: String(from),
        to: String(to),
        offset: String(offset),
        limit: String(limit)
      });
      
      if (creator_ids) {
        if (Array.isArray(creator_ids)) {
          creator_ids.forEach(id => params.append("creator_ids", String(id)));
        } else {
          params.append("creator_ids", String(creator_ids));
        }
      }

      const response = await fetchWithRetry(`${ONLYMONSTER_API_BASE}/api/v0/users/metrics?${params.toString()}`, {
        headers: { 
          'x-om-auth-token': OM_API_TOKEN,
          'accept': 'application/json'
        }
      });

      console.log(`[OnlyMonster] [DEBUG] Metrics Request: ${ONLYMONSTER_API_BASE}/api/v0/users/metrics?${params.toString()}`);
      console.log(`[OnlyMonster] [DEBUG] Metrics Status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[OnlyMonster] [DEBUG] Metrics Error Body: ${errorText}`);
        return res.status(response.status).json({ error: "OnlyMonster API (Metrics) error.", details: errorText });
      }

      const data = await response.json();
      console.log(`[OnlyMonster] [DEBUG] Metrics Raw Response Summary: ${JSON.stringify(data).slice(0, 500)}...`);
      console.log(`[OnlyMonster] [DEBUG] Metrics Items Count: ${data.items?.length || 0}`);
      metricsCache.set(cacheKey, {
        data,
        expiry: Date.now() + CACHE_TTL
      });

      res.json(data);
    } catch (error: any) {
      console.error("[OnlyMonster] [METRICS_ERROR]", error);
      res.status(500).json({ error: "Internal Server Error", message: error.message });
    }
  });

  // 1.1 List Accounts
  app.get("/api/accounts", async (req, res) => {
    try {
      const { limit = "100", cursor } = req.query;
      const params = new URLSearchParams({ limit: String(limit) });
      if (cursor) params.append("cursor", String(cursor));

      const response = await fetchWithRetry(`${ONLYMONSTER_API_BASE}/api/v0/accounts?${params.toString()}`, {
        headers: { 'x-om-auth-token': OM_API_TOKEN, 'accept': 'application/json' }
      });

      console.log(`[OnlyMonster] [DEBUG] Accounts Status: ${response.status}`);

      if (!response.ok) {
        const errTxt = await response.text();
        console.error(`[OnlyMonster] [DEBUG] Accounts Error: ${errTxt}`);
        return res.status(response.status).json({ error: "Failed to fetch accounts" });
      }
      const data = await response.json();
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 1.2 List Members (Operators)
  app.get("/api/members", async (req, res) => {
    try {
      const { limit = "50", offset = "0" } = req.query;
      const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });

      console.log(`[OnlyMonster] [DEBUG] Fetching members from: ${ONLYMONSTER_API_BASE}/api/v0/members?${params.toString()}`);

      const response = await fetchWithRetry(`${ONLYMONSTER_API_BASE}/api/v0/members?${params.toString()}`, {
        headers: { 
          'x-om-auth-token': OM_API_TOKEN, 
          'accept': 'application/json' 
        }
      });

      if (!response.ok) {
        const errTxt = await response.text();
        console.error(`[OnlyMonster] [DEBUG] Members Error: ${errTxt}`);
        return res.status(response.status).json({ error: "Failed to fetch members" });
      }
      
      const data = await response.json();
      console.log(`[OnlyMonster] [DEBUG] Members Count: ${data.users?.length || 0}`);
      res.json(data);
    } catch (err: any) {
      console.error("[OnlyMonster] [MEMBERS_ERROR]", err);
      res.status(500).json({ error: err.message });
    }
  });

  // 1.3 Transactions for specific account
  app.get("/api/transactions/:platform_account_id", async (req, res) => {
    try {
      const { platform_account_id } = req.params;
      const { start, end, limit = "50" } = req.query;
      
      const params = new URLSearchParams({ 
        start: String(start), 
        end: String(end), 
        limit: String(limit) 
      });

      const response = await fetchWithRetry(`${ONLYMONSTER_API_BASE}/api/v0/platforms/onlyfans/accounts/${platform_account_id}/transactions?${params.toString()}`, {
        headers: { 'x-om-auth-token': OM_API_TOKEN, 'accept': 'application/json' }
      });

      if (!response.ok) {
        const txt = await response.text();
        return res.status(response.status).json({ error: "Failed to fetch transactions", details: txt });
      }
      const data = await response.json();
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 1.4 Tracking Links
  app.get("/api/platforms/onlyfans/accounts/:platform_account_id/tracking-links", async (req, res) => {
    try {
      const { platform_account_id } = req.params;
      const { start, end, limit = "100" } = req.query;
      const params = new URLSearchParams({ start: String(start), end: String(end), limit: String(limit) });
      
      const response = await fetchWithRetry(`${ONLYMONSTER_API_BASE}/api/v0/platforms/onlyfans/accounts/${platform_account_id}/tracking-links?${params.toString()}`, {
        headers: { 'x-om-auth-token': OM_API_TOKEN, 'accept': 'application/json' }
      });

      if (!response.ok) return res.status(response.status).json({ error: "Failed to fetch tracking links" });
      const data = await response.json();
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 1.5 Trial Links
  app.get("/api/platforms/onlyfans/accounts/:platform_account_id/trial-links", async (req, res) => {
    try {
      const { platform_account_id } = req.params;
      const { start, end, limit = "100" } = req.query;
      const params = new URLSearchParams({ start: String(start), end: String(end), limit: String(limit) });
      
      const response = await fetchWithRetry(`${ONLYMONSTER_API_BASE}/api/v0/platforms/onlyfans/accounts/${platform_account_id}/trial-links?${params.toString()}`, {
        headers: { 'x-om-auth-token': OM_API_TOKEN, 'accept': 'application/json' }
      });

      if (!response.ok) return res.status(response.status).json({ error: "Failed to fetch trial links" });
      const data = await response.json();
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 1.6 Vault Folders
  app.get("/api/accounts/:account_id/vault/folders", async (req, res) => {
    try {
      const { account_id } = req.params;
      const { limit = "20", offset = "0" } = req.query;
      const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
      
      const response = await fetchWithRetry(`${ONLYMONSTER_API_BASE}/api/v0/accounts/${account_id}/vault/folders?${params.toString()}`, {
        headers: { 'x-om-auth-token': OM_API_TOKEN, 'accept': 'application/json' }
      });

      if (!response.ok) return res.status(response.status).json({ error: "Failed to fetch vault folders" });
      const data = await response.json();
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 2. Webhook Endpoint
  app.all("/api/webhook", async (req, res) => {
    try {
      const webhookHandler = await import("./api/onlymonster-webhook.js");
      return webhookHandler.default(req, res);
    } catch (err) {
      console.error("Webhook route error:", err);
      res.status(500).json({ error: "Webhook handler failed" });
    }
  });

  // Final API 404 handler - MUST come before static/vite
  app.use("/api/*", (req, res) => {
    console.warn(`[OnlyMonster] [404] API route not found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ error: "API Route not found", method: req.method, url: req.originalUrl });
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
