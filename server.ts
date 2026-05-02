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
  const OM_API_TOKEN = process.env.OM_API_TOKEN || "om_token_56b9c18f3db28e5700ea4d52a69a67bb6c7d699700cd7dc188b9150224a437d3";
  const OM_WEBHOOK_SECRET = process.env.OM_WEBHOOK_SECRET || "om_webhook_c568b3c21bf51b2ff3c66b9204786c72d9a9729628373a5db042a473770fb69e";
  const ONLYMONSTER_API_BASE = "https://omapi.onlymonster.ai";

  // --- State & Cache ---
  const processedSessions = new Set<string>();
  const metricsCache = new Map<string, { data: any; expiry: number }>();
  const CACHE_TTL = 60000; 
  let lastRequestTime = 0;
  const MIN_REQUEST_INTERVAL = 1000 / 15;

  // Helper for exponential backoff retry with timeout
  async function fetchWithRetry(url: string, options: any, retries = 3, backoff = 1000): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (response.ok) return response;
      
      // Retry for server errors (5xx) or Rate limits
      if (retries > 0 && (response.status >= 500 || response.status === 429)) {
        console.warn(`[OnlyMonster] API error ${response.status} at ${url}. Retrying in ${backoff}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoff));
        return fetchWithRetry(url, options, retries - 1, backoff * 2);
      }
      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (retries > 0) {
        const isTimeout = error.name === 'AbortError';
        console.warn(`[OnlyMonster] ${isTimeout ? 'Timeout' : 'Network error'} for ${url}. Retrying in ${backoff}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoff));
        return fetchWithRetry(url, options, retries - 1, backoff * 2);
      }
      throw error;
    }
  }

  // --- API Routes ---

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

  // 1.2 List Members
  app.get("/api/members", async (req, res) => {
    try {
      const { limit = "50", offset = "0" } = req.query;
      const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });

      const response = await fetchWithRetry(`${ONLYMONSTER_API_BASE}/api/v0/members?${params.toString()}`, {
        headers: { 'x-om-auth-token': OM_API_TOKEN, 'accept': 'application/json' }
      });

      if (!response.ok) return res.status(response.status).json({ error: "Failed to fetch members" });
      const data = await response.json();
      res.json(data);
    } catch (err: any) {
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

  // 2. Webhook Endpoint
  app.post("/api/webhook", (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${OM_WEBHOOK_SECRET}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const { event, data } = req.body;
    const session_id = data?.session_id || data?.id;

    if (session_id && processedSessions.has(session_id)) {
      return res.json({ status: "already_processed" });
    }

    if (event === "survey.completed") {
      if (session_id) processedSessions.add(session_id);
      console.log(`[OnlyMonster] [SUCCESS] Processing survey completion for ${session_id}`);
    }

    res.json({ received: true });
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
