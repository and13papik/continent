import { kv } from '@vercel/kv';

let localInMemoryToken = process.env.ONLYMONSTER_API_KEY || process.env.ONLYMONSTER_TOKEN || "";
let localInMemoryWebhookId = process.env.ONLYMONSTER_WEBHOOK_ID || "";

export function isKvConfigured(): boolean {
  return Boolean(
    (process.env.KV_REST_API_URL || process.env.VERCEL_KV_REST_API_URL) &&
    (process.env.KV_REST_API_TOKEN || process.env.VERCEL_KV_REST_API_TOKEN)
  );
}

export async function getOmToken(): Promise<string> {
  // 1. Try reading from Vercel KV if configured
  if (isKvConfigured()) {
    try {
      const savedKvToken = await kv.get<string>('onlymonster:token');
      if (savedKvToken && typeof savedKvToken === 'string' && savedKvToken.trim().length > 0) {
        return savedKvToken.trim();
      }
    } catch (e) {
      console.error('Error reading token from Vercel KV:', e);
    }
  }

  // 2. Fallback to process.env or local variable
  const envKey = process.env.ONLYMONSTER_API_KEY || process.env.ONLYMONSTER_TOKEN || localInMemoryToken || "";
  return envKey.trim();
}

export async function setOmToken(token: string): Promise<boolean> {
  const cleanToken = token.trim();
  if (!cleanToken) return false;

  localInMemoryToken = cleanToken;
  process.env.ONLYMONSTER_API_KEY = cleanToken;
  process.env.ONLYMONSTER_TOKEN = cleanToken;

  if (isKvConfigured()) {
    try {
      await kv.set('onlymonster:token', cleanToken);
      return true;
    } catch (e) {
      console.error('Error saving token to Vercel KV:', e);
      return false;
    }
  }
  return true;
}

export async function getOmWebhookId(): Promise<string> {
  if (isKvConfigured()) {
    try {
      const savedKvWebhook = await kv.get<string>('onlymonster:webhook_id');
      if (savedKvWebhook && typeof savedKvWebhook === 'string') {
        return savedKvWebhook;
      }
    } catch (e) {
      console.error('Error reading webhook_id from Vercel KV:', e);
    }
  }
  return process.env.ONLYMONSTER_WEBHOOK_ID || localInMemoryWebhookId || "";
}

export async function setOmWebhookId(id: string): Promise<boolean> {
  if (!id) return false;
  localInMemoryWebhookId = id;
  process.env.ONLYMONSTER_WEBHOOK_ID = id;

  if (isKvConfigured()) {
    try {
      await kv.set('onlymonster:webhook_id', id);
      return true;
    } catch (e) {
      console.error('Error saving webhook_id to Vercel KV:', e);
      return false;
    }
  }
  return true;
}
