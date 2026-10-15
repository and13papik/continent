import type { AppState, OperationRecord } from './types';
import { operatorPayrollRows } from './operatorPayroll';

export type PayrollPayment = {
  id: string; periodId: string; operator: string; kind: 'advance' | 'salary_payment';
  amount: string; date: string; comment: string;
};

export function parsePayrollAmount(value: string): number {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) throw new Error('Введите положительную сумму, не более двух знаков после запятой.');
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isSafeInteger(Math.round(amount * 100))) throw new Error('Введите корректную сумму больше нуля.');
  return amount;
}

/** One request ID survives retries; validate against the latest local state inside updateState. */
export function recordPayrollPayment(state: AppState, payment: PayrollPayment, now = new Date().toISOString()): AppState {
  const duplicate = state.operationsData.find(operation => operation.id === payment.id);
  if (duplicate) {
    if (duplicate.operator !== payment.operator || duplicate.periodId !== payment.periodId || duplicate.type !== payment.kind || duplicate.date !== payment.date || Math.round(duplicate.amount * 100) !== Math.round(parsePayrollAmount(payment.amount) * 100)) throw new Error('Идентификатор выплаты уже используется. Откройте PAY заново.');
    return state;
  }
  if (!payment.id || state.deletedIds.includes(payment.id)) throw new Error('Откройте PAY заново.');
  const period = state.accountingPeriods.find(period => period.id === payment.periodId);
  if (!period || period.status !== 'open') throw new Error('Этот месяц закрыт или недоступен.');
  if (state.selectedPeriodId !== payment.periodId) throw new Error('Период изменился. Откройте PAY заново.');
  if (!['advance', 'salary_payment'].includes(payment.kind)) throw new Error('Выберите вид выплаты.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payment.date) || !Number.isFinite(Date.parse(payment.date)) || new Date(payment.date).toISOString().slice(0, 10) !== payment.date) throw new Error('Укажите корректную дату выплаты.');
  if (state.accountingPeriods.some(period => period.status === 'closed' && period.startAt.slice(0, 7) === payment.date.slice(0, 7))) throw new Error('Дата относится к закрытому месяцу.');
  const row = operatorPayrollRows(state, payment.periodId).find(row => row.op === payment.operator);
  if (!row || row.isPaid) throw new Error('Расчёт недоступен или уже отмечен как выплаченный.');
  const enteredAmount = parsePayrollAmount(payment.amount);
  const availableCents = Math.round(row.remainder * 100), enteredCents = Math.round(enteredAmount * 100);
  if (availableCents <= 0 || enteredCents > availableCents) throw new Error('Сумма превышает текущий остаток. Проверьте расчёт и сумму.');
  const settles = payment.kind === 'salary_payment' && enteredCents === availableCents;
  // Preserve the existing full-settlement precision of percentage-based accruals.
  const amount = settles ? row.remainder : enteredAmount;
  const operation: OperationRecord = {
    id: payment.id, type: payment.kind, operator: payment.operator, periodId: payment.periodId,
    amount, date: payment.date, createdAt: now, updatedAt: now,
    comment: payment.comment.trim().slice(0, 500) || (payment.kind === 'advance' ? 'Аванс (PAY)' : 'Выплата зарплаты (PAY)'),
  };
  return {
    ...state, operationsData: [operation, ...state.operationsData],
    paidStatuses: settles ? [...state.paidStatuses, { id: `${payment.id}:paid`, entityName: payment.operator, entityType: 'operator', periodId: payment.periodId, createdAt: now, updatedAt: now }] : state.paidStatuses,
  };
}
