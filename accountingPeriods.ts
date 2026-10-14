import type { AccountingPeriod, AppState } from './types';

const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
export function monthKey(period: Pick<AccountingPeriod, 'startAt'>): string | null {
  const date = new Date(period.startAt);
  return Number.isFinite(date.getTime()) ? `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}` : null;
}

/** Repeated calls for the same source month select the same next month. */
export function startNextPeriod(state: AppState, sourceId: string, closeSource = false, now = new Date().toISOString()): AppState {
  const source = state.accountingPeriods.find(period => period.id === sourceId);
  if (!source || !monthKey(source)) return state;
  const start = new Date(source.startAt);
  start.setUTCDate(1); start.setUTCHours(0, 0, 0, 0); start.setUTCMonth(start.getUTCMonth() + 1);
  const key = monthKey({ startAt: start.toISOString() })!;
  const existing = state.accountingPeriods.find(period => monthKey(period) === key);
  // A stable ID also makes simultaneous creation on two devices converge.
  let nextId = existing?.id || `month-${key}`;
  let suffix = 1;
  while (!existing && state.deletedIds.includes(nextId)) nextId = `month-${key}:${++suffix}`;
  const periods = state.accountingPeriods.map(period => closeSource && period.id === sourceId && period.status !== 'closed'
    ? { ...period, operators: period.operators || state.operators, models: period.models || state.models,
      admins: period.admins || state.admins, modelRates: period.modelRates || state.modelRates,
      modelDefaultGoals: period.modelDefaultGoals || state.modelDefaultGoals || {},
      modelMonthlyPlans: period.modelMonthlyPlans || state.modelMonthlyPlans || {},
      status: 'closed' as const, endAt: now, updatedAt: now } : period);
  if (existing) return { ...state, accountingPeriods: periods, selectedPeriodId: nextId };
  const next: AccountingPeriod = { id: nextId, label: `${months[start.getUTCMonth()]} ${start.getUTCFullYear()}`, startAt: start.toISOString(), endAt: null, status: 'open',
    operators: source.operators || state.operators, models: source.models || state.models,
    modelRates: source.modelRates || state.modelRates, modelDefaultGoals: source.modelDefaultGoals || state.modelDefaultGoals,
    admins: source.admins || state.admins, createdAt: now, updatedAt: now };
  const copyRows = <T extends { id: string; periodId: string }>(rows: T[] = []) => rows.filter(row => row.periodId === sourceId)
    .map(row => ({ ...row, id: `${nextId}:${row.id}`, periodId: nextId }));
  return { ...state, accountingPeriods: [...periods, next], selectedPeriodId: nextId,
    rosterData: [...(state.rosterData || []), ...copyRows(state.rosterData)],
    operatorAssessments: [...(state.operatorAssessments || []), ...copyRows(state.operatorAssessments)] };
}

/** Reject newly introduced duplicates; never rewrite legacy months or financial links. */
export function periodValidationError(before: AccountingPeriod[], after: AccountingPeriod[]): string | null {
  if (new Set(after.map(period => period.id)).size !== after.length) return 'Повторяющийся ID периода';
  const old = new Map(before.map(period => [period.id, period]));
  for (const period of after) {
    if (!['open', 'closed'].includes(period.status)) return 'Некорректный статус периода';
    if ((!old.has(period.id) || old.get(period.id)!.startAt !== period.startAt) && !monthKey(period)) return 'Некорректная дата периода';
    if (typeof period.label !== 'string' || !period.label.trim()) return 'Укажите название периода';
  }
  const duplicatePairs = (periods: AccountingPeriod[]) => {
    const pairs = new Set<string>();
    for (let i = 0; i < periods.length; i++) for (let j = i + 1; j < periods.length; j++) {
      const a = periods[i], b = periods[j];
      if ((monthKey(a) && monthKey(a) === monthKey(b)) || a.label.trim().toLocaleLowerCase('ru') === b.label.trim().toLocaleLowerCase('ru')) pairs.add([a.id, b.id].sort().join('\u0000'));
    }
    return pairs;
  };
  const previous = duplicatePairs(before);
  if ([...duplicatePairs(after)].some(pair => !previous.has(pair))) return 'Этот месяц уже существует. Обновите данные и откройте существующий период.';
  return null;
}
