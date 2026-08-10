import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { isKvConfigured } from './om-store.js';
import { kv } from '@vercel/kv';

let localSupabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
let localSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || '';

export async function getSupabaseCredentials(): Promise<{ url: string; key: string } | null> {
  let url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || localSupabaseUrl;
  let key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || localSupabaseKey;

  if ((!url || !key) && isKvConfigured()) {
    try {
      const kvUrl = await kv.get<string>('onlymonster:supabase_url');
      const kvKey = await kv.get<string>('onlymonster:supabase_key');
      if (kvUrl && typeof kvUrl === 'string') url = kvUrl.trim();
      if (kvKey && typeof kvKey === 'string') key = kvKey.trim();
    } catch (e) {
      console.error('Error reading Supabase credentials from KV:', e);
    }
  }

  if (!url || !key) {
    return null;
  }

  return { url: url.trim().replace(/\/$/, ''), key: key.trim() };
}

export async function setSupabaseCredentials(url: string, key: string): Promise<boolean> {
  const cleanUrl = url.trim().replace(/\/$/, '');
  const cleanKey = key.trim();

  localSupabaseUrl = cleanUrl;
  localSupabaseKey = cleanKey;
  process.env.SUPABASE_URL = cleanUrl;
  process.env.SUPABASE_SERVICE_ROLE_KEY = cleanKey;

  if (isKvConfigured()) {
    try {
      await kv.set('onlymonster:supabase_url', cleanUrl);
      await kv.set('onlymonster:supabase_key', cleanKey);
      return true;
    } catch (e) {
      console.error('Error saving Supabase credentials to KV:', e);
      return false;
    }
  }
  return true;
}

export async function getSupabaseClient(): Promise<SupabaseClient | null> {
  const creds = await getSupabaseCredentials();
  if (!creds) return null;

  return createClient(creds.url, creds.key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

/**
 * Read-only check: Fetch list of all existing tables in Supabase via PostgREST OpenAPI spec endpoint
 */
export async function listExistingSupabaseTables(): Promise<{ success: boolean; tables: string[]; error?: string }> {
  const creds = await getSupabaseCredentials();
  if (!creds) {
    return { success: false, tables: [], error: 'Supabase credentials are not configured' };
  }

  try {
    const res = await fetch(`${creds.url}/rest/v1/`, {
      method: 'GET',
      headers: {
        'apikey': creds.key,
        'Authorization': `Bearer ${creds.key}`
      }
    });

    if (!res.ok) {
      return { success: false, tables: [], error: `Supabase API returned HTTP ${res.status}` };
    }

    const openApiSpec: any = await res.json();
    const paths = openApiSpec.paths || {};
    const tableNames = Object.keys(paths)
      .map(p => p.replace(/^\//, '').split('/')[0])
      .filter(p => p && p !== 'rpc');

    const uniqueTables = Array.from(new Set(tableNames));
    return { success: true, tables: uniqueTables };
  } catch (err: any) {
    return { success: false, tables: [], error: err.message || String(err) };
  }
}
