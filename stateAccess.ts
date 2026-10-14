import type { AppState, OwnerTask } from './types';

export const PRIVATE_OWNER_FIELDS = ['ownerExpenses', 'ownerManualIncomes', 'ownerAdvances', 'ownerNotes', 'ownerDocument', 'completedDocument'] as const;
export const ADMIN_FIELDS = ['lastUpdated', 'version', 'remoteVersion', 'syncRevision', 'operators', 'operatorWallets', 'models', 'modelGroups', 'admins', 'incomeData', 'operationsData', 'rosterData', 'operatorAssessments', 'priorityModels', 'inactiveModels', 'accountingPeriods', 'selectedPeriodId', 'modelRates', 'modelBonuses', 'paidStatuses', 'advanceRequests', 'totalTableEntries', 'modelDefaultGoals', 'modelMonthlyPlans', 'deletedIds', 'syncUrl', 'lastSyncedAt', 'notifiedInterns', 'telegramState'] as const;
export const isAdminTask = (task: Pick<OwnerTask, 'assignedTo' | 'isForAdmins'>) => task.isForAdmins === true || ['Admins', 'All', 'Rector', 'Mentor'].includes(task.assignedTo);
export const emptyOwnerField = (key: string) => key.endsWith('Document') ? '' : [];
export function adminRecoveryItem(item: { path: unknown[]; local: any; remote: any }): boolean {
  if (item.path[0] === 'ownerTasks') return item.path.length === 2 && [item.local, item.remote].every(task => task === undefined || isAdminTask(task));
  return (ADMIN_FIELDS as readonly unknown[]).includes(item.path[0]);
}

/** Explicit allowlist: a future owner field cannot accidentally become public to admins. */
export function adminView(state: AppState): AppState {
  const result: any = {};
  for (const key of ADMIN_FIELDS) if (Object.hasOwn(state, key)) result[key] = state[key];
  for (const key of PRIVATE_OWNER_FIELDS) result[key] = emptyOwnerField(key);
  result.ownerTasks = (state.ownerTasks || []).filter(isAdminTask);
  result.accessScope = 'admin';
  result.manualIncomeTotals = state.accessScope === 'admin' ? (state.manualIncomeTotals || {}) :
    (state.ownerManualIncomes || []).reduce<Record<string, number>>((totals, row) => {
      totals[row.periodId] = (totals[row.periodId] || 0) + row.amount; return totals;
    }, {});
  return result;
}

export function manualIncomeTotal(state: AppState, periodId: string): number {
  return state.accessScope === 'admin' ? state.manualIncomeTotals?.[periodId] || 0 :
    (state.ownerManualIncomes || []).filter(row => row.periodId === periodId).reduce((sum, row) => sum + row.amount, 0);
}
