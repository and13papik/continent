import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { AppState } from '../types';
import type { RecoveryItem } from '../cloudSync';
import { sameValue } from '../cloudSync';
import type { RecoveryNotice } from '../syncStorage';
import { recoveryValue } from '../syncRecovery';
import { adminRecoveryItem } from '../stateAccess';

const labels: Record<string, string> = { incomeData: 'Доходы', operationsData: 'Операции', totalTableEntries: 'Total Table', rosterData: 'Состав', ownerExpenses: 'Расходы овнеров', ownerManualIncomes: 'Доходы овнеров', ownerAdvances: 'Авансы овнеров', accountingPeriods: 'Периоды', modelRates: 'Ставки', paidStatuses: 'Выплаты', ownerDocument: 'Документ овнеров', completedDocument: 'Завершённые задачи' };
const fieldLabels: Record<string, string> = { date: 'Дата', model: 'Модель', modelName: 'Модель', operator: 'Оператор', total: 'Всего', amount: 'Сумма', onlyFans: 'OnlyFans', paypal: 'PayPal', crypto: 'Crypto', nettoOF: 'Зарплата · OnlyFans', nettoPP: 'Зарплата · PayPal', nettoCrypto: 'Зарплата · Crypto', percentOF: 'Ставка OF, %', percentPP: 'Ставка PP, %', percentCrypto: 'Ставка Crypto, %', balance: 'Баланс', goal: 'План', night: 'Ночь', morning: 'Утро', day: 'День', evening: 'Вечер', comment: 'Комментарий', type: 'Тип', category: 'Категория', platform: 'Платформа', status: 'Статус', name: 'Имя', title: 'Название', rate: 'Ставка', label: 'Название', startAt: 'Начало', endAt: 'Окончание', of: 'OnlyFans', pp: 'PayPal', cr: 'Crypto' };
function ValuePreview({ value, other }: { value: any; other: any }) {
  if (value === undefined) return <p className="text-sm text-slate-400">Запись отсутствует / удалена</p>;
  if (value === null || typeof value !== 'object') return <p className={`text-sm whitespace-pre-wrap break-words ${sameValue(value, other) ? 'text-slate-300' : 'text-amber-200 font-bold'}`}>{value === null ? '—' : typeof value === 'boolean' ? (value ? 'Да' : 'Нет') : String(value)}</p>;
  return <dl className="space-y-2">{Object.entries(value).filter(([key]) => !['id','periodId','createdAt','updatedAt'].includes(key)).map(([key, entry]) => <div key={key} className="border-b border-slate-700/50 pb-2"><dt className="text-xs text-slate-400 mb-1">{fieldLabels[key] || (Array.isArray(value) ? `Запись ${Number(key) + 1}` : key)}</dt><dd><ValuePreview value={entry} other={other?.[key]} /></dd></div>)}</dl>;
}

export default function SyncRecovery({ state, notices, owner, resolve }: {
  state: AppState; notices: RecoveryNotice[]; owner: boolean;
  resolve: (notice: RecoveryNotice, item: RecoveryItem, useLocal: boolean, expected: any) => Promise<void>;
}) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
      if (event.key !== 'Tab') return;
      const buttons = [...(dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || [])];
      const first = buttons[0], last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); previous?.focus(); };
  }, [open]);
  const items = notices.flatMap(notice => notice.items.filter(item => owner || adminRecoveryItem(item)).map(item => ({ notice, item })));
  if (!items.length) return null;
  const choose = async (notice: RecoveryNotice, item: RecoveryItem, useLocal: boolean, expected: any) => {
    setBusy(true); setError('');
    try { await resolve(notice, item, useLocal, expected); } catch (error) { setError(error instanceof Error ? error.message : 'Не удалось сохранить выбор. Повторите.'); }
    finally { setBusy(false); }
  };
  return <>
    <button onClick={() => setOpen(true)} className="p-3 rounded-xl text-left border border-amber-500/40 bg-amber-500/10 text-amber-200 text-xs">
      <strong>Данные обновлены · проверить {items.length}</strong>
      <span className="block mt-1 text-slate-300">Спорные правки сохранены отдельно на этом устройстве. Открыть сравнение.</span>
    </button>
    {open && createPortal(<div ref={dialog} className="fixed inset-0 z-[100] bg-black/80 p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-label="Проверка сохранённых правок">
      <div className="max-w-4xl mx-auto rounded-2xl border border-slate-600 bg-[#151c2e] p-6 space-y-5">
        <div className="flex justify-between gap-4"><h2 className="text-xl font-bold">Сохранённые правки ({items.length})</h2><button onClick={() => setOpen(false)} className="text-indigo-300">Закрыть</button></div>
        <p className="text-sm text-slate-300">Сайт продолжает обновляться. Эти варианты отличаются от общих данных и требуют проверки. Выбор «Применить правку» изменит общие данные. Резервная копия останется на этом устройстве после выбора.</p>
        {error && <p role="alert" className="text-rose-300">{error}</p>}
        {items.slice(0, 20).map(({ notice, item }) => {
          const current = recoveryValue(state, item), root = String(item.path[0]);
          return <section key={`${notice.id}:${item.field}`} className="border border-slate-700 rounded-xl p-4 space-y-3">
            <h3 className="font-bold">{labels[root] || root}</h3>
            <p className="text-xs text-slate-400">Копия от {new Date(notice.createdAt).toLocaleString('ru-RU')} · отличия выделены жёлтым</p>
            <div className="grid md:grid-cols-2 gap-3">
              <div><p className="text-sm text-indigo-300 mb-2">Сохранённая правка устройства</p><div className="bg-black/20 p-3 rounded-lg max-h-80 overflow-auto"><ValuePreview value={item.local} other={current} /></div></div>
              <div><p className="text-sm text-emerald-300 mb-2">Сейчас на сайте</p><div className="bg-black/20 p-3 rounded-lg max-h-80 overflow-auto"><ValuePreview value={current} other={item.local} /></div></div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button disabled={busy} onClick={() => void choose(notice, item, false, current)} className="px-4 py-2 rounded-lg bg-slate-700 disabled:opacity-50">Оставить текущее</button>
              {(owner || adminRecoveryItem(item)) && <button disabled={busy} onClick={() => void choose(notice, item, true, current)} className="px-4 py-2 rounded-lg bg-indigo-600 disabled:opacity-50">Применить правку устройства</button>}
            </div>
          </section>;
        })}
        {items.length > 20 && <p className="text-sm text-slate-400">Показаны первые 20. Следующие появятся после проверки этих записей.</p>}
      </div>
    </div>, document.body)}
  </>;
}
