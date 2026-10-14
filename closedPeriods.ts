import type { AppState, AccountingPeriod } from './types';
import { sameValue, type RecoveryItem } from './cloudSync.js';
import { monthKey } from './accountingPeriods.js';

export const PERIOD_RECORDS = ['incomeData', 'operationsData', 'ownerExpenses', 'ownerManualIncomes', 'ownerAdvances', 'modelBonuses', 'paidStatuses', 'advanceRequests', 'totalTableEntries', 'rosterData', 'operatorAssessments'] as const;
const SETTINGS = ['operators', 'models', 'admins', 'modelRates', 'modelDefaultGoals', 'modelMonthlyPlans'] as const;
const content = (row: any) => row && Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'updatedAt'));
const periodContent = (period: AccountingPeriod) => Object.fromEntries(Object.entries(content(period)).filter(([key]) => !['status', 'endAt'].includes(key)));
const dateMonth = (date: unknown): string | null => {
  if (typeof date !== 'string') return null;
  const iso = date.match(/^(\d{4})[-.](\d{2})[-.]\d{2}/);
  if (iso) return `${iso[1]}-${iso[2]}`;
  const legacy = date.match(/^\d{2}[.-](\d{2})[.-](\d{4})$/);
  return legacy ? `${legacy[2]}-${legacy[1]}` : null;
};

/** Compare with the authoritative saved state, never the selected month or client role. */
export function closedPeriodChanges(before: AppState, after: AppState, role: 'owner' | 'admin' = 'owner'): RecoveryItem[] {
  const closed = before.accountingPeriods.filter(period => period.status === 'closed');
  if (!closed.length) return [];
  const ids = new Set(closed.map(period => period.id));
  const months = new Set(closed.map(monthKey).filter(Boolean));
  const result: RecoveryItem[] = [];
  const add = (key: string, local: any, remote: any, id?: string) => result.push({ field: id ? `${key}[${id}]` : key, path: id ? [key, { id }] : [key], local, remote });
  const previousDeleted = new Set(before.deletedIds), nextDeleted = new Set(after.deletedIds);
  for (const key of PERIOD_RECORDS) {
    // Roster dates are reusable templates copied between periods by the existing
    // application; their assigned period, not the source template date, owns them.
    const locked = (row: any) => row && (ids.has(row.periodId) || (!['rosterData', 'operatorAssessments'].includes(key) && months.has(dateMonth(row.date || (!row.periodId ? row.createdAt : undefined)))));
    const previous = before[key] || [], next = after[key] || [];
    if (sameValue(previous, next) && sameValue(before.deletedIds, after.deletedIds)) continue;
    if (!Array.isArray(next)) { add(key, next, previous); continue; }
    const all = [...previous, ...next];
    if (!all.some(locked)) continue;
    if (all.some(row => !row || typeof row.id !== 'string') || new Set(previous.map(row => row.id)).size !== previous.length || new Set(next.map(row => row.id)).size !== next.length) {
      if (!sameValue(previous, next)) add(key, next, previous);
      if (!sameValue(before.deletedIds, after.deletedIds)) add('deletedIds', after.deletedIds, before.deletedIds);
      continue;
    }
    const oldRows = new Map(previous.map(row => [row.id, row]));
    const newRows = new Map(next.map(row => [row.id, row]));
    for (const id of new Set([...oldRows.keys(), ...newRows.keys()])) {
      const old = oldRows.get(id), value = newRows.get(id);
      if ((locked(old) || locked(value)) && (!sameValue(content(old), content(value)) || previousDeleted.has(id) !== nextDeleted.has(id))) add(key, value, old, id);
    }
  }
  // Legacy months inherit these settings. Do not let an edit to a global fallback
  // change their historical calculation or staff without first reopening them.
  for (const key of SETTINGS) {
    if (closed.some(period => period[key] === undefined) && !sameValue(before[key], after[key])) add(key, after[key], before[key]);
  }
  for (const old of closed) {
    const value = after.accountingPeriods.find(period => period.id === old.id);
    const reopening = role === 'owner' && value?.status === 'open' && sameValue(periodContent(old), periodContent(value));
    if (!value || previousDeleted.has(old.id) !== nextDeleted.has(old.id) || (!sameValue(content(old), content(value)) && !reopening) || (reopening && result.length)) add('accountingPeriods', value, old, old.id);
  }
  return result;
}

export const CLOSED_PERIOD_MESSAGE = 'Изменение не сохранено: оно затрагивает закрытый месяц. Овнер должен сначала открыть его в Настройках → Управление периодами и дождаться синхронизации.';

export function reopenPeriod(state: AppState, id: string): AppState {
  return { ...state, accountingPeriods: state.accountingPeriods.map(period => period.id === id && period.status === 'closed'
    ? { ...period, status: 'open', endAt: null, updatedAt: new Date().toISOString() } : period) };
}
