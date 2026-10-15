import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { AppState } from '../types';
import { operatorPayrollRows } from '../operatorPayroll';
import { parsePayrollAmount, recordPayrollPayment, type PayrollPayment } from '../payrollPayments';
import { money } from './RefinedUI';

export default function PayrollPaymentDialog({ state, operator, periodId, updateState, close }: {
  state: AppState; operator: string; periodId: string;
  updateState: (updater: (prev: AppState) => AppState) => boolean | void; close: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const submitting = useRef(false);
  const [id] = useState(() => `payroll-${crypto.randomUUID()}`);
  const [kind, setKind] = useState<PayrollPayment['kind']>('salary_payment');
  const row = operatorPayrollRows(state, periodId).find(row => row.op === operator);
  const available = row && !row.isPaid ? Math.max(0, row.remainder) : 0;
  const period = state.accountingPeriods.find(period => period.id === periodId);
  const [amount, setAmount] = useState(() => available.toFixed(2));
  const [date, setDate] = useState(() => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; });
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const unavailable = period?.status !== 'open' || state.selectedPeriodId !== periodId || !row || row.isPaid;
  let entered = 0;
  try { entered = parsePayrollAmount(amount); } catch { /* Validation is shown on submit. */ }
  useEffect(() => {
    const element = dialog.current!, previousFocus = document.activeElement as HTMLElement | null;
    element.showModal();
    return () => { element.close(); previousFocus?.focus(); };
  }, []);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setError('');
    try {
      const accepted = updateState(previous => recordPayrollPayment(previous, { id, operator, periodId, kind, amount, date, comment }));
      if (accepted === false) { setError('Не удалось сохранить. Проверьте уведомление синхронизации и повторите.'); return; }
      close();
    } catch (error) { setError(error instanceof Error ? error.message : 'Не удалось сохранить выплату.'); }
    finally { submitting.current = false; }
  };
  return createPortal(<dialog ref={dialog} className="ct-pay-dialog" aria-labelledby="pay-title" onCancel={close}>
    <form onSubmit={submit}>
      <header><div><h2 id="pay-title">PAY · {operator}</h2><p>{period?.label}</p></div><button type="button" aria-label="Закрыть PAY" onClick={close}><X size={20} /></button></header>
      <div className="ct-pay-kind" role="group" aria-label="Вид выплаты">{[{ value: 'advance', label: 'Аванс' }, { value: 'salary_payment', label: 'Остаток' }].map(item => <button type="button" key={item.value} aria-pressed={kind === item.value} onClick={() => { setKind(item.value as PayrollPayment['kind']); setAmount(item.value === 'advance' ? '' : available.toFixed(2)); setError(''); }}>{item.label}</button>)}</div>
      <p className="ct-pay-available">Доступно к выплате <strong>{money(available)}</strong></p>
      <label>Сумма, USD<input autoFocus required inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0,00" /></label>
      <small>{kind === 'advance' ? 'Аванс уменьшит остаток зарплаты.' : 'Можно выплатить весь остаток или указать меньшую сумму.'}</small>
      <label>Дата выплаты<input type="date" required value={date} onChange={e => setDate(e.target.value)} /></label>
      <label>Комментарий<textarea value={comment} maxLength={500} rows={2} onChange={e => setComment(e.target.value)} placeholder="Необязательно" /></label>
      <div className="ct-pay-preview"><span>{kind === 'advance' ? 'Аванс' : 'Выплата зарплаты'}</span><strong>{money(entered)}</strong><span>Останется</span><strong>{money(Math.max(0, available - entered))}</strong></div>
      <p className="ct-pay-explanation">Будет сохранена запись выплаты. Перевод денег выполняется отдельно.</p>
      {unavailable && <p role="alert">Период закрыт, сменился или выплата уже отмечена. Закройте PAY и проверьте ведомость.</p>}
      {error && <p role="alert">{error}</p>}
      <footer><button type="button" onClick={close}>Отмена</button><button type="submit" disabled={unavailable}>Подтвердить {money(entered)}</button></footer>
    </form>
  </dialog>, document.body);
}
