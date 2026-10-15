import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, X } from 'lucide-react';
import type { AppState } from '../types';

export default function OperatorManagementDialog({ state, updateState, close }: {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => boolean | void;
  close: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [periodId] = useState(state.selectedPeriodId);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const period = state.accountingPeriods.find(item => item.id === periodId);
  const members = period?.operators || state.operators;
  const available = state.operators.filter(operator => !members.includes(operator));
  const unavailable = period?.status !== 'open' || state.selectedPeriodId !== periodId;

  useEffect(() => {
    const element = dialog.current!, previousFocus = document.activeElement as HTMLElement | null;
    element.showModal();
    return () => { element.close(); previousFocus?.focus(); };
  }, []);

  const change = (operator: string, add: boolean) => {
    const value = operator.trim();
    if (!value || unavailable) return;
    if (!add && !confirm(`Убрать ${value} из состава на этот месяц? Доходы, выплаты и история сохранятся.`)) return;
    setError('');
    const accepted = updateState(previous => {
      const current = previous.accountingPeriods.find(item => item.id === periodId);
      if (previous.selectedPeriodId !== periodId || current?.status !== 'open') return previous;
      const operators = current.operators || previous.operators;
      if (add && operators.includes(value)) return previous;
      return {
        ...previous,
        operators: add && !previous.operators.includes(value) ? [...previous.operators, value] : previous.operators,
        accountingPeriods: previous.accountingPeriods.map(item => item.id === periodId ? {
          ...item,
          operators: add ? [...operators, value] : operators.filter(member => member !== value),
          updatedAt: new Date().toISOString(),
        } : item),
      };
    });
    if (accepted === false) setError('Не удалось сохранить. Проверьте синхронизацию и повторите.');
    else if (add) setName('');
  };

  return createPortal(<dialog ref={dialog} className="ct-pay-dialog ct-operator-management" aria-labelledby="operator-management-title" onCancel={close}>
    <header><div><h2 id="operator-management-title">Управление операторами</h2><p>{period?.label}</p></div><button type="button" aria-label="Закрыть управление операторами" onClick={close}><X size={20} /></button></header>
    <form onSubmit={event => { event.preventDefault(); change(name, true); }}>
      <label>Имя оператора<input autoFocus required maxLength={100} value={name} disabled={unavailable} onChange={event => setName(event.target.value)} placeholder="@username" /></label>
      <button type="submit" className="ct-button ct-primary" disabled={unavailable || !name.trim()}><Plus size={16} />Добавить</button>
    </form>
    {available.length > 0 && <section><h3>Добавить из общего списка</h3><div className="ct-operator-available">{available.map(operator => <button type="button" key={operator} disabled={unavailable} onClick={() => change(operator, true)}>{operator}<Plus size={14} /></button>)}</div></section>}
    <section><h3>В составе · {members.length}</h3><div className="ct-operator-members">{members.map(operator => <div key={operator}><span>{operator}</span><button type="button" disabled={unavailable} aria-label={`Убрать из состава ${operator}`} onClick={() => change(operator, false)}><X size={16} /></button></div>)}</div></section>
    <p className="ct-pay-explanation">Изменение состава не удаляет финансовые записи. Операторы с историей за месяц останутся в ведомости.</p>
    {unavailable && <p role="alert">Этот период закрыт или сменился. Изменение состава недоступно.</p>}
    {error && <p role="alert">{error}</p>}
    <footer><button type="button" onClick={close}>Готово</button></footer>
  </dialog>, document.body);
}
