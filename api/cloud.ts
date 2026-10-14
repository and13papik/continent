import { json, readBody, requireSession } from './_lib/auth.js';
import { getSupabaseCredentials } from './_lib/supabase.js';
import { sameValue, validCloudState } from '../cloudSync.js';
import { adminView, ADMIN_FIELDS, PRIVATE_OWNER_FIELDS, emptyOwnerField, isAdminTask } from '../stateAccess.js';
import { periodValidationError } from '../accountingPeriods.js';
import { readAuditHistory } from './_lib/audit.js';

const LOCAL_FIELDS = ['syncUrl', 'syncKey', 'dbUrl', 'selectedPeriodId'];

function clientRow(row: any, role: string) {
  if (!row?.state) return row;
  const { syncKey, dbUrl, ...state } = row.state;
  delete state.accessScope; delete state.manualIncomeTotals;
  return { ...row, state: role === 'owner' ? state : adminView(state) };
}

export default async function handler(req: any, res: any) {
  const user = await requireSession(req, res);
  if (!user) return;
  if (req.method !== 'GET' && req.method !== 'PATCH') return json(res, 405, { error: 'Method not allowed' });
  const query = new URL(req.url || '/', 'https://dashboard.invalid').searchParams;
  if (query.get('view') === 'audit') return readAuditHistory(req, res, user);
  const creds = await getSupabaseCredentials();
  if (!creds) return json(res, 503, { error: 'База данных не настроена на сервере' });
  const endpoint = new URL('/rest/v1/app_storage', creds.url);
  const headers = { apikey: creds.key, Authorization: `Bearer ${creds.key}` };
  try {
    if (req.method === 'GET') {
      const id = query.get('id');
      if (id && !/^eq\.[A-Za-z0-9_.:-]{1,150}$/.test(id)) return json(res, 400, { error: 'Invalid snapshot' });
      if (id !== 'eq.main' && user.role !== 'owner') return json(res, 403, { error: 'История доступна овнеру' });
      if (id) endpoint.searchParams.set('id', id);
      const select = query.get('select') || 'id,state,updated_at';
      if (!['id', 'id,updated_at', 'id,updated_at,revision:state->>syncRevision', 'state', 'state,updated_at', 'id,state,updated_at'].includes(select)) return json(res, 400, { error: 'Invalid selection' });
      endpoint.searchParams.set('select', select);
      endpoint.searchParams.set('order', 'updated_at.desc');
      endpoint.searchParams.set('limit', id ? '1' : '20');
      // List metadata separately; each state is fetched individually to stay within Vercel's response limit.
      if (!id) endpoint.searchParams.set('select', 'id,updated_at');
      const response = await fetch(endpoint, { headers, signal: AbortSignal.timeout(12000), redirect: 'error' });
      if (!response.ok) return json(res, 502, { error: 'Не удалось прочитать облако' });
      const rows = await response.json();
      return json(res, 200, rows.map((row: any) => clientRow(row, user.role)));
    }

    if (query.get('id') !== 'eq.main') return json(res, 400, { error: 'Only main can be updated' });
    const timestamp = query.get('updated_at'), revision = query.get('state->>syncRevision');
    if (!timestamp || !revision || !/^(is\.null|eq\..{1,80})$/.test(timestamp) || !/^(is\.null|eq\.[A-Za-z0-9-]{1,80})$/.test(revision)) return json(res, 400, { error: 'Conditional save required' });
    const body = readBody(req);
    if (!validCloudState(body.state) || typeof body.updated_at !== 'string' || !Number.isFinite(Date.parse(body.updated_at)) || !body.state.syncRevision) return json(res, 400, { error: 'Invalid state' });
    if (user.role === 'owner' && body.state.accessScope === 'admin') return json(res, 409, { error: 'Обновите страницу после смены аккаунта' });

    const readUrl = new URL(endpoint);
    readUrl.search = new URLSearchParams({ id: 'eq.main', select: 'state,updated_at' }).toString();
    const before = await fetch(readUrl, { headers, signal: AbortSignal.timeout(12000), redirect: 'error' });
    if (!before.ok) return json(res, 502, { error: 'Не удалось проверить текущие данные' });
    const rows = await before.json();
    if (rows.length !== 1 || !validCloudState(rows[0].state)) return json(res, 409, { error: 'Основная запись недоступна' });
    const old = rows[0];
    if (timestamp !== (old.updated_at === null ? 'is.null' : `eq.${old.updated_at}`) || revision !== (old.state.syncRevision ? `eq.${old.state.syncRevision}` : 'is.null')) return json(res, 200, []);
    if (body.state.syncRevision === old.state.syncRevision || body.state.version <= old.state.version) return json(res, 400, { error: 'Нужна новая версия сохранения' });
    const periodError = periodValidationError(old.state.accountingPeriods, body.state.accountingPeriods);
    if (periodError) return json(res, 400, { error: periodError });
    // Preserve all unknown stored fields; admins can write only explicitly shared fields.
    const next = { ...old.state, ...body.state };
    if (user.role !== 'owner') {
      const hiddenTasks = (old.state.ownerTasks || []).filter((task: any) => !isAdminTask(task));
      const privateCollections = Object.keys(old.state).filter(key => !(ADMIN_FIELDS as readonly string[]).includes(key) && key !== 'ownerTasks');
      const protectedIds = new Set([...privateCollections.flatMap(key => Array.isArray(old.state[key]) ? old.state[key].map((row: any) => row.id) : []), ...hiddenTasks.map((task: any) => task.id), ...old.state.accountingPeriods.map((period: any) => period.id)]);
      const oldDeleted = new Set(old.state.deletedIds), newDeleted = new Set(body.state.deletedIds);
      const deletedOwnerRecord = [...protectedIds].some(id => oldDeleted.has(id) !== newDeleted.has(id));
      // Empty placeholders mean "not visible", never "delete the owner's records".
      if (deletedOwnerRecord || PRIVATE_OWNER_FIELDS.some(key => !sameValue((body.state as any)[key] ?? emptyOwnerField(key), emptyOwnerField(key)) && !sameValue((body.state as any)[key], old.state[key]))) return json(res, 403, { error: 'Изменение данных овнеров запрещено' });
      const structure = (periods: any[]) => periods.map(({ id, label, startAt, endAt, status }) => ({ id, label, startAt, endAt, status })).sort((a, b) => a.id.localeCompare(b.id));
      if (!sameValue(structure(old.state.accountingPeriods), structure(body.state.accountingPeriods))) return json(res, 403, { error: 'Изменять периоды может только овнер' });
      const tasks = body.state.ownerTasks || [];
      if (!Array.isArray(tasks) || new Set(tasks.map((task: any) => task.id)).size !== tasks.length || tasks.some((task: any) => {
        const hidden = hiddenTasks.find((oldTask: any) => oldTask.id === task.id);
        return hidden ? !sameValue(task, hidden) : !isAdminTask(task);
      })) return json(res, 403, { error: 'Изменение личных задач овнеров запрещено' });
      const allowed = new Set<string>([...ADMIN_FIELDS, ...PRIVATE_OWNER_FIELDS, 'ownerTasks', 'accessScope', 'manualIncomeTotals', ...LOCAL_FIELDS]);
      if (Object.keys(body.state).some(key => !allowed.has(key) && !sameValue((body.state as any)[key], old.state[key]))) return json(res, 403, { error: 'Изменение поля запрещено' });
      for (const key of PRIVATE_OWNER_FIELDS) {
        if (Object.hasOwn(old.state, key)) next[key] = old.state[key]; else delete next[key];
      }
      const visibleTasks = new Map<string, any>(tasks.filter(isAdminTask).map((task: any) => [task.id, task]));
      const previousTasks = old.state.ownerTasks || [];
      next.ownerTasks = previousTasks.flatMap((task: any) => !isAdminTask(task) ? [task] : visibleTasks.has(task.id) ? [visibleTasks.get(task.id)] : []);
      next.ownerTasks.push(...tasks.filter((task: any) => isAdminTask(task) && !previousTasks.some((previous: any) => previous.id === task.id)));
    }
    delete next.accessScope; delete next.manualIncomeTotals;
    for (const key of LOCAL_FIELDS) {
      if (Object.hasOwn(old.state, key)) next[key] = old.state[key];
      else delete next[key];
    }
    endpoint.search = new URLSearchParams({ id: 'eq.main', select: 'state,updated_at', updated_at: timestamp, 'state->>syncRevision': revision }).toString();
    const response = await fetch(endpoint, { method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=representation',
      'x-continental-actor-id': user.id, 'x-continental-actor-name': user.username, 'x-continental-actor-role': user.role,
    }, body: JSON.stringify({ state: next, updated_at: body.updated_at }), signal: AbortSignal.timeout(15000), redirect: 'error' });
    if (!response.ok) return json(res, 502, { error: 'Облако не подтвердило сохранение' });
    return json(res, 200, (await response.json()).map((row: any) => clientRow(row, user.role)));
  } catch { return json(res, 502, { error: 'Нет подтверждённого ответа базы данных' }); }
}
