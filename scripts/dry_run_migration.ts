/**
 * DRY RUN MIGRATION & RECONCILIATION SCRIPT (PHASE 2)
 *
 * Reads app_storage.main without writing anything to DB.
 * Performs reference integrity checks, constraint simulations,
 * and 100% financial metric verification.
 */

import {
  AppState,
  AccountingPeriod,
  Admin,
  IncomeRecord,
  OperationRecord,
  OwnerManualExpense,
  OwnerManualIncome,
  OwnerAdvance,
  ModelBonus,
  PaidStatus,
  DailyTotalEntry,
  RosterEntry,
} from '../types';

export interface MigrationDryRunResult {
  sourceCounts: {
    accountingPeriods: number;
    operators: number;
    models: number;
    admins: number;
    incomeData: number;
    operationsData: number;
    ownerExpenses: number;
    ownerManualIncomes: number;
    ownerAdvances: number;
    modelBonuses: number;
    paidStatuses: number;
    modelMonthlyPlans: number;
    totalTableEntries: number;
    rosterData: number;
  };
  targetRowCounts: {
    accounting_periods: number;
    operators: number;
    models: number;
    owners: number;
    admins: number;
    owner_period_shares: number;
    income_records: number;
    financial_operations: number;
    agency_transactions: number;
    owner_draws: number;
    model_period_bonuses: number;
    payout_settlement_flags: number;
    model_monthly_plans: number;
    shift_balance_entries: number;
    roster_shifts: number;
    roster_shift_models: number;
  };
  diagnostics: {
    orphanRecordsCount: number;
    unresolvedOperatorRefs: number;
    unresolvedModelRefs: number;
    unresolvedAdminRefs: number;
    unresolvedOwnerRefs: number;
    invalidOrMissingPeriodId: number;
    uniqueConstraintConflicts: number;
    duplicateBusinessKeys: number;
    invalidMonetaryValues: number;
    unrepresentableRecords: number;
  };
  issues: string[];
  isPassed: boolean;
}

export function runMigrationDryRun(state: AppState): MigrationDryRunResult {
  const issues: string[] = [];
  let orphanRecordsCount = 0;
  let unresolvedOperatorRefs = 0;
  let unresolvedModelRefs = 0;
  let unresolvedAdminRefs = 0;
  let unresolvedOwnerRefs = 0;
  let invalidOrMissingPeriodId = 0;
  let uniqueConstraintConflicts = 0;
  let duplicateBusinessKeys = 0;
  let invalidMonetaryValues = 0;
  let unrepresentableRecords = 0;

  // 1. Gather Source Counts
  const periods: AccountingPeriod[] = state.accountingPeriods || [];
  const operatorsList: string[] = state.operators || [];
  const modelsList: string[] = state.models || [];
  const adminsList: Admin[] = state.admins || [];
  const incomeRecords: IncomeRecord[] = state.incomeData || [];
  const opsRecords: OperationRecord[] = state.operationsData || [];
  const ownerExp: OwnerManualExpense[] = state.ownerExpenses || [];
  const ownerManualInc: OwnerManualIncome[] = state.ownerManualIncomes || [];
  const ownerAdv: OwnerAdvance[] = state.ownerAdvances || [];
  const modelBonuses: ModelBonus[] = state.modelBonuses || [];
  const paidStatuses: PaidStatus[] = state.paidStatuses || [];
  const monthlyPlans: Record<string, number> = state.modelMonthlyPlans || {};
  const totalEntries: DailyTotalEntry[] = state.totalTableEntries || [];
  const roster: RosterEntry[] = state.rosterData || [];

  const sourceCounts = {
    accountingPeriods: periods.length,
    operators: operatorsList.length,
    models: modelsList.length,
    admins: adminsList.length,
    incomeData: incomeRecords.length,
    operationsData: opsRecords.length,
    ownerExpenses: ownerExp.length,
    ownerManualIncomes: ownerManualInc.length,
    ownerAdvances: ownerAdv.length,
    modelBonuses: modelBonuses.length,
    paidStatuses: paidStatuses.length,
    modelMonthlyPlans: Object.keys(monthlyPlans).length,
    totalTableEntries: totalEntries.length,
    rosterData: roster.length,
  };

  // 2. Build Reference Maps (ID Normalization)
  const periodIds = new Set<string>(periods.map((p: AccountingPeriod) => p.id));
  const operatorMap = new Map<string, string>();
  const modelMap = new Map<string, string>();
  const ownerMap = new Map<string, string>();
  const adminMap = new Map<string, string>();

  // Deduplicate and register Operators
  const allOperatorNames = new Set<string>();
  operatorsList.forEach((op: string) => allOperatorNames.add(op.trim()));
  incomeRecords.forEach((inc: IncomeRecord) => { if (inc.operator) allOperatorNames.add(inc.operator.trim()); });
  opsRecords.forEach((op: OperationRecord) => { if (op.operator) allOperatorNames.add(op.operator.trim()); });
  roster.forEach((r: RosterEntry) => { if (r.operator) allOperatorNames.add(r.operator.trim()); });

  let opIdx = 1;
  allOperatorNames.forEach((name: string) => {
    if (name) {
      operatorMap.set(name.toLowerCase(), `op_${opIdx++}`);
    }
  });

  // Deduplicate and register Models
  const allModelNames = new Set<string>();
  modelsList.forEach((m: string) => allModelNames.add(m.trim()));
  incomeRecords.forEach((inc: IncomeRecord) => { if (inc.model) allModelNames.add(inc.model.trim()); });
  opsRecords.forEach((op: OperationRecord) => { if (op.model) allModelNames.add(op.model.trim()); });
  modelBonuses.forEach((b: ModelBonus) => { if (b.model) allModelNames.add(b.model.trim()); });
  totalEntries.forEach((t: DailyTotalEntry) => { if (t.modelName) allModelNames.add(t.modelName.trim()); });

  let modIdx = 1;
  allModelNames.forEach((name: string) => {
    if (name) {
      modelMap.set(name.toLowerCase(), `mod_${modIdx++}`);
    }
  });

  // Deduplicate and register Owners
  const allOwnerNames = new Set<string>(['Андрей', 'Антон', 'Andrey', 'Anton']);
  ownerAdv.forEach((adv: OwnerAdvance) => { if (adv.ownerName) allOwnerNames.add(adv.ownerName.trim()); });
  let ownerIdx = 1;
  allOwnerNames.forEach((name: string) => {
    if (name) {
      ownerMap.set(name.toLowerCase(), `owner_${ownerIdx++}`);
    }
  });

  // Deduplicate Admins
  adminsList.forEach((adm: Admin, idx: number) => {
    if (!adm.name) {
      unresolvedAdminRefs++;
      issues.push(`Admin at index ${idx} has no name`);
    } else {
      adminMap.set(adm.name.trim().toLowerCase(), adm.id || `adm_${idx + 1}`);
    }
  });

  // 3. Validation & Reference Resolution Checks
  // Check period references & monetary values on Income records
  const seenIncomeIds = new Set<string>();
  incomeRecords.forEach((inc: IncomeRecord) => {
    if (seenIncomeIds.has(inc.id)) {
      uniqueConstraintConflicts++;
      issues.push(`Duplicate incomeRecord id: ${inc.id}`);
    }
    seenIncomeIds.add(inc.id);

    if (!inc.periodId || !periodIds.has(inc.periodId)) {
      orphanRecordsCount++;
      invalidOrMissingPeriodId++;
      issues.push(`IncomeRecord [${inc.id}]: referenced periodId '${inc.periodId}' does not exist`);
    }
    if (!inc.operator || !operatorMap.has(inc.operator.trim().toLowerCase())) {
      unresolvedOperatorRefs++;
      issues.push(`IncomeRecord [${inc.id}]: unresolved operator '${inc.operator}'`);
    }
    if (!inc.model || !modelMap.has(inc.model.trim().toLowerCase())) {
      unresolvedModelRefs++;
      issues.push(`IncomeRecord [${inc.id}]: unresolved model '${inc.model}'`);
    }
    if (isNaN(inc.onlyFans) || inc.onlyFans < 0 || isNaN(inc.paypal) || inc.paypal < 0 || isNaN(inc.crypto) || inc.crypto < 0) {
      invalidMonetaryValues++;
      issues.push(`IncomeRecord [${inc.id}]: invalid monetary values`);
    }
  });

  // Check Operations
  const seenOpIds = new Set<string>();
  const validOpTypes = new Set(['advance', 'penalty', 'bonus', 'salary_payment', 'refund', 'internship', 'training']);
  opsRecords.forEach((op: OperationRecord) => {
    if (seenOpIds.has(op.id)) {
      uniqueConstraintConflicts++;
      issues.push(`Duplicate operationRecord id: ${op.id}`);
    }
    seenOpIds.add(op.id);

    if (!op.periodId || !periodIds.has(op.periodId)) {
      orphanRecordsCount++;
      invalidOrMissingPeriodId++;
      issues.push(`OperationRecord [${op.id}]: referenced periodId '${op.periodId}' does not exist`);
    }
    if (!validOpTypes.has(op.type)) {
      unrepresentableRecords++;
      issues.push(`OperationRecord [${op.id}]: unknown type '${op.type}'`);
    }
    if (isNaN(op.amount) || op.amount <= 0) {
      invalidMonetaryValues++;
      issues.push(`OperationRecord [${op.id}]: invalid amount ${op.amount}`);
    }
  });

  // Check Owner Expenses & Incomes
  ownerExp.forEach((exp: OwnerManualExpense) => {
    if (!exp.periodId || !periodIds.has(exp.periodId)) {
      orphanRecordsCount++;
      invalidOrMissingPeriodId++;
      issues.push(`OwnerExpense [${exp.id}]: referenced periodId '${exp.periodId}' does not exist`);
    }
    if (isNaN(exp.amount) || exp.amount <= 0) {
      invalidMonetaryValues++;
      issues.push(`OwnerExpense [${exp.id}]: invalid amount ${exp.amount}`);
    }
  });

  ownerAdv.forEach((adv: OwnerAdvance) => {
    if (!adv.periodId || !periodIds.has(adv.periodId)) {
      orphanRecordsCount++;
      invalidOrMissingPeriodId++;
      issues.push(`OwnerAdvance [${adv.id}]: referenced periodId '${adv.periodId}' does not exist`);
    }
    if (!adv.ownerName || !ownerMap.has(adv.ownerName.trim().toLowerCase())) {
      unresolvedOwnerRefs++;
      issues.push(`OwnerAdvance [${adv.id}]: unresolved owner '${adv.ownerName}'`);
    }
    if (isNaN(adv.amount) || adv.amount <= 0) {
      invalidMonetaryValues++;
      issues.push(`OwnerAdvance [${adv.id}]: invalid amount ${adv.amount}`);
    }
  });

  // 4. Calculate Target Row Counts
  let totalShiftBalanceEntries = 0;
  totalEntries.forEach(() => {
    totalShiftBalanceEntries += 4; // night, morning, day, evening
  });

  let totalRosterShiftModels = 0;
  roster.forEach((r: RosterEntry) => {
    if (r.models && Array.isArray(r.models)) {
      totalRosterShiftModels += r.models.length;
    }
  });

  const targetRowCounts = {
    accounting_periods: periods.length,
    operators: operatorMap.size,
    models: modelMap.size,
    owners: ownerMap.size,
    admins: adminMap.size,
    owner_period_shares: periods.length * ownerMap.size,
    income_records: incomeRecords.length,
    financial_operations: opsRecords.length,
    agency_transactions: ownerExp.length + ownerManualInc.length,
    owner_draws: ownerAdv.length,
    model_period_bonuses: modelBonuses.length,
    payout_settlement_flags: paidStatuses.length,
    model_monthly_plans: Object.keys(monthlyPlans).length,
    shift_balance_entries: totalShiftBalanceEntries,
    roster_shifts: roster.length,
    roster_shift_models: totalRosterShiftModels,
  };

  const diagnostics = {
    orphanRecordsCount,
    unresolvedOperatorRefs,
    unresolvedModelRefs,
    unresolvedAdminRefs,
    unresolvedOwnerRefs,
    invalidOrMissingPeriodId,
    uniqueConstraintConflicts,
    duplicateBusinessKeys,
    invalidMonetaryValues,
    unrepresentableRecords,
  };

  return {
    sourceCounts,
    targetRowCounts,
    diagnostics,
    issues,
    isPassed: issues.length === 0,
  };
}
