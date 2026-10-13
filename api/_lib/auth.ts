import { createClient } from '@supabase/supabase-js';
import type { Session, User } from '@supabase/supabase-js';

export type DashboardRole = 'admin' | 'owner';
export type DashboardUser = { id: string; username: string; role: DashboardRole; cloudUrl: string };
const ACCESS_COOKIE = '__Host-continental-access';
const REFRESH_COOKIE = '__Host-continental-refresh';

export function json(res: any, status: number, body: unknown) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(status).json(body);
}

export function authClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Authentication is not configured');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

function cookieName(name: string) {
  // __Host- requires Secure. Plain HTTP is permitted only for explicit local development.
  return process.env.APP_ORIGIN === 'http://localhost:3000' && process.env.NODE_ENV !== 'production'
    ? name.replace('__Host-', '') : name;
}

export function cookies(req: any) {
  const parsed = new Map<string, string>();
  for (const part of String(req.headers?.cookie || '').split(';')) {
    const at = part.indexOf('=');
    if (at < 0) continue;
    try { parsed.set(part.slice(0, at).trim(), decodeURIComponent(part.slice(at + 1))); } catch { /* invalid cookie */ }
  }
  return { access: parsed.get(cookieName(ACCESS_COOKIE)) || '', refresh: parsed.get(cookieName(REFRESH_COOKIE)) || '' };
}

export function setSessionCookies(res: any, session: Session | null) {
  const local = cookieName(ACCESS_COOKIE) !== ACCESS_COOKIE;
  const options = `; Path=/; HttpOnly; SameSite=Strict${local ? '' : '; Secure'}; Max-Age=${session ? 604800 : 0}`;
  res.setHeader('Set-Cookie', [
    `${cookieName(ACCESS_COOKIE)}=${encodeURIComponent(session?.access_token || '')}${options}`,
    `${cookieName(REFRESH_COOKIE)}=${encodeURIComponent(session?.refresh_token || '')}${options}`,
  ]);
}

export function dashboardUser(user: User | null): DashboardUser | null {
  const role = user?.app_metadata?.continental_role;
  // user_metadata and request-supplied roles are deliberately never used for authorization.
  if (!user?.id || !user.email_confirmed_at || (role !== 'admin' && role !== 'owner')) return null;
  return { id: user.id, username: user.app_metadata.continental_username || '', role, cloudUrl: process.env.SUPABASE_URL || '' };
}

export function loginIdentity(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const username = value.trim().replace(/^@/, '').toLowerCase();
  if (!/^[a-z0-9_]{3,32}$/.test(username)) return null;
  // Supabase manages password hashing and sessions; the synthetic address is internal,
  // confirmed by provisioning, never an email login or a delivery destination.
  return `${username}@accounts.continental.invalid`;
}

export function sameOrigin(req: any, res: any): boolean {
  const expected = process.env.APP_ORIGIN;
  const origin = req.headers?.origin;
  if (!expected) { json(res, 503, { error: 'Сервер авторизации ещё не настроен' }); return false; }
  if (origin !== expected || req.headers?.['sec-fetch-site'] === 'cross-site') {
    json(res, 403, { error: 'Запрос с другого сайта запрещён' }); return false;
  }
  return true;
}

// Share validation between Express middleware and a handler only within the same request.
const verified = new WeakMap<object, DashboardUser>();
export async function requireSession(req: any, res: any, ownerOnly = false): Promise<DashboardUser | null> {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method || 'GET') && !sameOrigin(req, res)) return null;
  let actor = verified.get(req);
  if (!actor) {
    const { access } = cookies(req);
    if (!access) { json(res, 401, { error: 'Требуется вход' }); return null; }
    try {
      const { data, error } = await authClient().auth.getUser(access);
      if (error) {
        json(res, error.status && error.status >= 500 ? 503 : 401, { error: 'Не удалось подтвердить вход' });
        return null;
      }
      actor = dashboardUser(data.user) || undefined;
      if (!actor) { json(res, 403, { error: 'Доступ к Continental не назначен' }); return null; }
      verified.set(req, actor);
    } catch { json(res, 503, { error: 'Сервис входа временно недоступен' }); return null; }
  }
  if (ownerOnly && actor.role !== 'owner') { json(res, 403, { error: 'Доступно только овнеру' }); return null; }
  return actor;
}

export function readBody(req: any): Record<string, any> {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    return body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  } catch { return {}; }
}
