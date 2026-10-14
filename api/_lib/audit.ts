import { json, type DashboardUser } from './auth.js';
import { getSupabaseCredentials } from './supabase.js';
import { AUDIT_COLLECTIONS, AUDIT_ACTIONS } from '../../auditHistory.js';

const METADATA = 'id:id::text,created_at,actor_username,actor_role,collection,record_id,action,period_id,label';
const validId = (value: string) => /^[1-9]\d{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n;

export async function readAuditHistory(req: any, res: any, user: DashboardUser) {
  if (user.role !== 'owner') return json(res, 403, { error: 'История действий доступна только овнеру' });
  if (req.method !== 'GET') return json(res, 405, { error: 'Историю нельзя изменять' });
  const query = new URL(req.url || '/', 'https://dashboard.invalid').searchParams;
  const id = query.get('eventId'), cursor = query.get('cursor');
  const collection = query.get('collection'), action = query.get('action');
  if ((id !== null && !validId(id)) || (cursor !== null && !validId(cursor)) ||
      (collection !== null && !Object.hasOwn(AUDIT_COLLECTIONS, collection)) ||
      (action !== null && !Object.hasOwn(AUDIT_ACTIONS, action))) return json(res, 400, { error: 'Некорректный фильтр истории' });
  try {
    const creds = await getSupabaseCredentials();
    if (!creds) return json(res, 503, { error: 'История пока недоступна' });
    const endpoint = new URL('/rest/v1/app_audit_events', creds.url);
    endpoint.searchParams.set('select', id ? `${METADATA},before_value,after_value` : METADATA);
    endpoint.searchParams.set('order', 'id.desc');
    endpoint.searchParams.set('limit', id ? '1' : '51');
    if (id) endpoint.searchParams.set('id', `eq.${id}`);
    else {
      if (cursor) endpoint.searchParams.set('id', `lt.${cursor}`);
      if (collection) endpoint.searchParams.set('collection', `eq.${collection}`);
      if (action) endpoint.searchParams.set('action', `eq.${action}`);
    }
    const response = await fetch(endpoint, { headers: { apikey: creds.key, Authorization: `Bearer ${creds.key}` }, signal: AbortSignal.timeout(12000), redirect: 'error' });
    if (!response.ok) return json(res, 502, { error: 'Не удалось загрузить историю. Попробуйте ещё раз.' });
    const rows = await response.json();
    if (!Array.isArray(rows) || rows.some(row => typeof row.id !== 'string' || !validId(row.id))) throw new Error('Invalid audit response');
    if (id) return rows.length ? json(res, 200, rows[0]) : json(res, 404, { error: 'Запись не найдена' });
    return json(res, 200, { events: rows.slice(0, 50), nextCursor: rows.length > 50 ? rows[49].id : null });
  } catch { return json(res, 502, { error: 'Не удалось загрузить историю. Попробуйте ещё раз.' }); }
}
