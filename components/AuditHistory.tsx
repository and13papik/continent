import React, { useCallback, useEffect, useRef, useState } from 'react';
import { History, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { AUDIT_ACTIONS, AUDIT_COLLECTIONS, auditChanges, auditValue, type AuditEvent, type AuditPage } from '../auditHistory';

async function getHistory<T>(params: URLSearchParams, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/cloud?view=audit&${params}`, { credentials: 'same-origin', cache: 'no-store', signal });
  if (!response.ok) throw new Error(response.status === 401 ? 'Войдите в аккаунт заново, чтобы посмотреть историю.' : 'Не удалось загрузить историю. Попробуйте ещё раз.');
  return response.json();
}

function AuditDetails({ event }: { event: AuditEvent }) {
  const [details, setDetails] = useState<AuditEvent | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setDetails(null); setError('');
    getHistory<AuditEvent>(new URLSearchParams({ eventId: event.id }), controller.signal).then(setDetails).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [event.id, retry]);
  if (error) return <div role="alert" className="p-4 text-sm text-rose-300">{error} <button type="button" onClick={() => setRetry(n => n + 1)} className="underline">Повторить</button></div>;
  if (!details) return <p role="status" className="p-4 text-sm text-slate-400">Загрузка изменений…</p>;
  const changes = auditChanges(details.before_value, details.after_value);
  return <div className="overflow-x-auto border-t border-slate-700/60">
    <table className="w-full text-sm text-left">
      <thead className="text-slate-400"><tr><th className="p-3">Поле</th><th className="p-3">Было</th><th className="p-3">Стало</th></tr></thead>
      <tbody>{changes.map((change, i) => <tr key={`${change.field}-${i}`} className="border-t border-slate-800">
        <th className="p-3 align-top font-medium text-slate-300">{change.field}</th>
        <td className="p-3 align-top whitespace-pre-wrap break-words max-w-xs text-rose-200">{auditValue(change.before, change.field)}</td>
        <td className="p-3 align-top whitespace-pre-wrap break-words max-w-xs text-emerald-200">{auditValue(change.after, change.field)}</td>
      </tr>)}</tbody>
    </table>
    {!changes.length && <p className="p-3 text-sm text-slate-400">История фиксирует изменения с момента включения.</p>}
  </div>;
}

export default function AuditHistory() {
  const [open, setOpen] = useState(false), [collection, setCollection] = useState(''), [action, setAction] = useState('');
  const [page, setPage] = useState<AuditPage>({ events: [], nextCursor: null });
  const [loading, setLoading] = useState(false), [error, setError] = useState(''), [refresh, setRefresh] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const load = useCallback(async (cursor?: string) => {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setLoading(true); setError('');
    const params = new URLSearchParams();
    if (collection) params.set('collection', collection);
    if (action) params.set('action', action);
    if (cursor) params.set('cursor', cursor);
    try {
      const result = await getHistory<AuditPage>(params, controller.signal);
      if (!controller.signal.aborted) setPage(previous => ({ events: cursor ? [...previous.events, ...result.events] : result.events, nextCursor: result.nextCursor }));
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Не удалось загрузить историю'); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, [collection, action]);
  useEffect(() => {
    setPage({ events: [], nextCursor: null }); setExpanded(null);
    if (open) void load();
    return () => request.current?.abort();
  }, [open, load, refresh]);
  return <section className="p-5 md:p-8 rounded-[2.5rem] border border-slate-700/70 bg-slate-900/60 space-y-5" aria-label="История действий">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h2 className="text-xl font-bold text-white flex items-center gap-2"><History size={20} className="text-indigo-400" />История действий</h2>
        <p className="text-sm text-slate-400 mt-1">Доходы, расходы, выплаты и настройки расчётов. Доступно только овнеру.</p></div>
      <button type="button" aria-expanded={open} onClick={() => setOpen(value => !value)} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-bold">{open ? 'Скрыть историю' : 'Показать историю'}</button>
    </div>
    {open && <>
      <p className="text-xs text-slate-400">Автор — аккаунт, сохранивший изменение. Общий аккаунт овнеров отображается одним именем. Старые изменения до включения журнала здесь не появятся.</p>
      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-xs text-slate-400">Раздел<select aria-label="Раздел истории" value={collection} onChange={e => setCollection(e.target.value)} className="block mt-1 bg-slate-800 border border-slate-700 rounded-xl p-2 text-sm text-white"><option value="">Все разделы</option>{Object.entries(AUDIT_COLLECTIONS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className="text-xs text-slate-400">Действие<select aria-label="Действие в истории" value={action} onChange={e => setAction(e.target.value)} className="block mt-1 bg-slate-800 border border-slate-700 rounded-xl p-2 text-sm text-white"><option value="">Все действия</option>{Object.entries(AUDIT_ACTIONS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <button type="button" onClick={() => setRefresh(n => n + 1)} disabled={loading} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 text-sm text-white disabled:opacity-50"><RefreshCw size={16} />Обновить историю</button>
      </div>
      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
      {!loading && !error && !page.events.length && <p className="text-sm text-slate-400">Изменений по выбранным условиям пока нет.</p>}
      <div className="space-y-3">{page.events.map(event => <article key={event.id} className="border border-slate-700/60 rounded-2xl overflow-hidden">
        <button type="button" aria-expanded={expanded === event.id} onClick={() => setExpanded(id => id === event.id ? null : event.id)} className="w-full text-left p-4 flex items-start gap-3 hover:bg-slate-800/60">
          <div className="flex-1 min-w-0"><div className="text-sm text-white font-semibold break-words">{AUDIT_ACTIONS[event.action] || event.action} · {AUDIT_COLLECTIONS[event.collection] || event.collection}</div><div className="text-sm text-slate-300 mt-1 break-words">{event.label === '$' ? 'Настройки' : event.label}</div>
            <div className="text-xs text-slate-400 mt-2">{event.actor_role === 'system' ? 'Система / сервер' : `@${event.actor_username}`} · {new Date(event.created_at).toLocaleString('ru-RU', { timeZone: 'Europe/Kyiv' })} (Киев)</div></div>
          {expanded === event.id ? <ChevronUp size={18} className="text-slate-400 shrink-0" /> : <ChevronDown size={18} className="text-slate-400 shrink-0" />}
        </button>
        {expanded === event.id && <AuditDetails event={event} />}
      </article>)}</div>
      {loading && <p role="status" className="text-sm text-slate-400">Загрузка истории…</p>}
      {page.nextCursor && <button type="button" disabled={loading} onClick={() => void load(page.nextCursor!)} className="px-4 py-2 rounded-xl bg-slate-800 text-white text-sm disabled:opacity-50">Показать ещё</button>}
    </>}
  </section>;
}
