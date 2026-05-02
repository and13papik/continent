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
  const ONLYMONSTER_API_TOKEN = process.env.ONLYMONSTER_API_TOKEN || "om_token_56b9c18f3db28e5700ea4d52a69a67bb6c7d699700cd7dc188b9150224a437d3";
  const SURVEY_ID = process.env.SURVEY_ID || "49307";
  const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "om_webhook_c568b3c21bf51b2ff3c66b9204786c72d9a9729628373a5db042a473770fb69e";
  const ONLYMONSTER_API_BASE = "https://omapi.onlymonster.ai";

  // --- API Routes ---

  // In-memory cache for deduplication (production should use Redis/DB)
  const processedSessions = new Set<string>();
  const PLATFORM_ACCOUNT_ID = "276441797";

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

  // 1. Event Tracking Endpoint (Updated to remove 404 routes, logging events locally)
  app.post("/api/track-event", async (req, res) => {
    try {
      const { event_name, session_id, user_id, step, metadata } = req.body;

      if (!event_name || !session_id) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      console.log(`[OnlyMonster] [EVENT] ${event_name} | Session: ${session_id}`);
      
      // Since surveys/:id/events causes 404, we'll log locally as per requirement to fix 404s
      res.json({ success: true, message: "Logged locally" });
    } catch (error) {
      console.error('[OnlyMonster] [CRITICAL] Internal tracking error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // 1.1 Dashboard Data Proxy (AGREGATION & DATA FETCHING)
  app.post("/api/onlymonster/dashboard-data", async (req, res) => {
    try {
      const { from, to, creator_id } = req.body;
      
      const metricsParams = new URLSearchParams({ 
        from, 
        to, 
        creator_ids: creator_id, 
        offset: '0', 
        limit: '100' 
      });
      // Ensure user_ids is only added if we actually have specific users to filter by (currently we don't)
      
      const trackingParams = new URLSearchParams({ start: from, end: to });
      // Platform transactions might prefer start/end or no pagination if 400 persists, 
      // but we'll try to stick to basic offset/limit first if that's what the platform expects.
      const transactionsParams = new URLSearchParams({ 
        start: from, 
        end: to, 
        offset: '0', 
        limit: '100' 
      });

      console.log(`[OnlyMonster] [PROXY] Fetching full dashboard data for account ${creator_id} (Platform: ${PLATFORM_ACCOUNT_ID})`);

      // Metrics usually works with x-om-auth-token
      const metricsRes = await fetchWithRetry(`${ONLYMONSTER_API_BASE}/api/v0/users/metrics?${metricsParams.toString()}`, {
        headers: { 'x-om-auth-token': ONLYMONSTER_API_TOKEN, 'accept': 'application/json' }
      });

      // Platform endpoints might be more sensitive to header naming or token permissions
      const fetchPlatformData = async (path: string, params: URLSearchParams) => {
        // Try with x-om-auth-token
        let res = await fetchWithRetry(`${ONLYMONSTER_API_BASE}${path}?${params.toString()}`, {
          headers: { 'x-om-auth-token': ONLYMONSTER_API_TOKEN, 'accept': 'application/json' }
        });

        // If 403, attempt Bearer token fallback just in case
        if (res.status === 403) {
          console.warn(`[OnlyMonster] [403] x-om-auth-token failed for ${path}. Trying Bearer fallback...`);
          res = await fetchWithRetry(`${ONLYMONSTER_API_BASE}${path}?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${ONLYMONSTER_API_TOKEN}`, 'accept': 'application/json' }
          });
        }
        return res;
      };

      const [trackingRes, transactionsRes] = await Promise.all([
        fetchPlatformData(`/api/v0/platforms/onlyfans/accounts/${PLATFORM_ACCOUNT_ID}/tracking-links`, trackingParams),
        fetchPlatformData(`/api/v0/platforms/onlyfans/accounts/${PLATFORM_ACCOUNT_ID}/transactions`, transactionsParams)
      ]);

      const result: any = { metrics: { items: [] }, tracking: { items: [] }, transactions: { items: [] } };

      if (metricsRes.ok) {
        result.metrics = await metricsRes.json();
      } else {
        console.error(`[OnlyMonster] [ERROR] Metrics failed: ${metricsRes.status}`);
      }

      if (trackingRes.ok) {
        result.tracking = await trackingRes.json();
      } else {
        console.error(`[OnlyMonster] [ERROR] Tracking failed: ${trackingRes.status}`);
        // Graceful fallback: return empty items instead of 502
      }

      if (transactionsRes.ok) {
        result.transactions = await transactionsRes.json();
      } else {
        const errorText = await transactionsRes.clone().text().catch(() => "N/A");
        console.error(`[OnlyMonster] [ERROR] Transactions failed: ${transactionsRes.status}`, errorText);
      }

      res.json(result);
    } catch (error) {
      console.error('[OnlyMonster] [ERROR] Proxy fetch failed:', error);
      res.status(500).json({ error: 'Internal proxy error' });
    }
  });

  // 2. Webhook Endpoint
  app.post("/api/webhook", (req, res) => {
    // 1. Security Check (Bearer Token Validation)
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${WEBHOOK_SECRET}`) {
      console.warn(`[OnlyMonster] [UNAUTHORIZED] Blocked webhook attempt with invalid secret.`);
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const { event, data } = req.body;
    const session_id = data?.session_id || data?.id;

    // 2. Deduplication check
    if (session_id && processedSessions.has(session_id)) {
      console.log(`[OnlyMonster] [SKIP] Duplicate webhook for session: ${session_id}`);
      return res.json({ status: "already_processed" });
    }

    console.log(`[OnlyMonster] [WEBHOOK] Received: ${event} | Session: ${session_id}`);

    if (event === "survey.completed") {
      if (session_id) processedSessions.add(session_id);
      
      console.log(`[OnlyMonster] [SUCCESS] Processing survey completion for ${session_id}`);
      // Integrate with CRM/DB here
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
