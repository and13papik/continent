import { authClient, cookies, dashboardUser, json, loginIdentity, readBody, requireSession, sameOrigin, setSessionCookies } from './_lib/auth.js';

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    const user = await requireSession(req, res);
    if (user) return json(res, 200, { user });
    return;
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  if (!sameOrigin(req, res)) return;
  const body = readBody(req);
  try {
    const client = authClient();
    if (body.action === 'logout') {
      const stored = cookies(req);
      if (stored.access) await client.auth.admin.signOut(stored.access, 'local').catch(() => {});
      setSessionCookies(res, null);
      return json(res, 200, { success: true });
    }
    if (body.action === 'refresh') {
      const { refresh } = cookies(req);
      if (!refresh) return json(res, 401, { error: 'Требуется вход' });
      const { data, error } = await client.auth.refreshSession({ refresh_token: refresh });
      if (error || !data.session) {
        // Transient failures must not erase a recoverable session.
        return json(res, error?.status && error.status >= 500 ? 503 : 401, { error: 'Не удалось продлить вход' });
      }
      const user = dashboardUser(data.user);
      if (!user) return json(res, 403, { error: 'Доступ к Continental не назначен' });
      setSessionCookies(res, data.session);
      return json(res, 200, { user });
    }
    const identity = loginIdentity(body.username);
    if (body.action !== 'login' || !identity || typeof body.password !== 'string' ||
        !body.password || body.password.length > 1024) {
      return json(res, 400, { error: 'Введите username и пароль' });
    }
    // Supabase Auth verifies the password and applies its server-side login rate limits.
    const { data, error } = await client.auth.signInWithPassword({ email: identity, password: body.password });
    if (error || !data.session) return json(res, error?.status === 429 ? 429 : 401, { error: error?.status === 429 ? 'Слишком много попыток. Попробуйте позже.' : 'Неверные данные входа' });
    const user = dashboardUser(data.user);
    if (!user) return json(res, 403, { error: 'Доступ к Continental не назначен' });
    setSessionCookies(res, data.session);
    return json(res, 200, { user });
  } catch { return json(res, 503, { error: 'Сервис входа временно недоступен' }); }
}
