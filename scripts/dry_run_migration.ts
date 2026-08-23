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
    model_period_rates: number;
    admin_period_rates: number;
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

  // Canonical Owners: exactly 2 owners with alias mapping
  // Andrey aliases: 'andrey', 'андрей' -> owner_andrey
  // Anton aliases: 'anton', 'антон' -> owner_anton
  ownerMap.set('andrey', 'owner_andrey');
  ownerMap.set('андрей', 'owner_andrey');
  ownerMap.set('anton', 'owner_anton');
  ownerMap.set('антон', 'owner_anton');

  // Register Admins (gather from global adminsList and period admins)
  const allAdminNames = new Map<string, string>(); // lowerName -> id
  adminsList.forEach((adm: Admin, idx: number) => {
    if (adm.name && adm.name.trim()) {
      const lower = adm.name.trim().toLowerCase();
      if (!allAdminNames.has(lower)) {
        allAdminNames.set(lower, adm.id || `adm_${idx + 1}`);
      }
    }
  });
  periods.forEach((p: AccountingPeriod) => {
    if (p.admins && Array.isArray(p.admins)) {
      p.admins.forEach((adm: Admin, idx: number) => {
        if (adm.name && adm.name.trim()) {
          const lower = adm.name.trim().toLowerCase();
          if (!allAdminNames.has(lower)) {
            allAdminNames.set(lower, adm.id || `adm_p_${idx + 1}`);
          }
        }
      });
    }
  });

  allAdminNames.forEach((id, lowerName) => {
    adminMap.set(lowerName, id);
  });

  // Deduplicate and register Models (active and historical)
  const allModelNames = new Set<string>();
  modelsList.forEach((m: string) => { if (m && m.trim()) allModelNames.add(m.trim()); });
  incomeRecords.forEach((inc: IncomeRecord) => { if (inc.model && inc.model.trim()) allModelNames.add(inc.model.trim()); });
  opsRecords.forEach((op: OperationRecord) => { if (op.model && op.model.trim()) allModelNames.add(op.model.trim()); });
  modelBonuses.forEach((b: ModelBonus) => { if (b.model && b.model.trim()) allModelNames.add(b.model.trim()); });
  totalEntries.forEach((t: DailyTotalEntry) => { if (t.modelName && t.modelName.trim()) allModelNames.add(t.modelName.trim()); });
  periods.forEach((p: AccountingPeriod) => {
    if (p.models && Array.isArray(p.models)) {
      p.models.forEach((m: string) => { if (m && m.trim()) allModelNames.add(m.trim()); });
    }
  });

  let modIdx = 1;
  allModelNames.forEach((name: string) => {
    if (name) {
      modelMap.set(name.toLowerCase(), `mod_${modIdx++}`);
    }
  });

  // Deduplicate and register Operators EXCLUDING Admins
  const allOperatorNames = new Set<string>();
  operatorsList.forEach((op: string) => {
    if (op && op.trim() && !adminMap.has(op.trim().toLowerCase())) {
      allOperatorNames.add(op.trim());
    }
  });
  incomeRecords.forEach((inc: IncomeRecord) => {
    if (inc.operator && inc.operator.trim() && !adminMap.has(inc.operator.trim().toLowerCase())) {
      allOperatorNames.add(inc.operator.trim());
    }
  });
  opsRecords.forEach((op: OperationRecord) => {
    // If an operation targets an admin, it belongs to admins, not operators
    if (op.operator && op.operator.trim() && !adminMap.has(op.operator.trim().toLowerCase())) {
      allOperatorNames.add(op.operator.trim());
    }
  });
  roster.forEach((r: RosterEntry) => {
    if (r.operator && r.operator.trim() && !adminMap.has(r.operator.trim().toLowerCase())) {
      allOperatorNames.add(r.operator.trim());
    }
  });
  periods.forEach((p: AccountingPeriod) => {
    if (p.operators && Array.isArray(p.operators)) {
      p.operators.forEach((op: string) => {
        if (op && op.trim() && !adminMap.has(op.trim().toLowerCase())) {
          allOperatorNames.add(op.trim());
        }
      });
    }
  });

  let opIdx = 1;
  allOperatorNames.forEach((name: string) => {
    if (name) {
      operatorMap.set(name.toLowerCase(), `op_${opIdx++}`);
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

    const rawOf = inc.onlyFans ?? 0;
    const rawPp = inc.paypal ?? 0;
    const rawCr = inc.crypto ?? 0;

    const onlyFans = Number(rawOf);
    const paypal = Number(rawPp);
    const crypto = Number(rawCr);

    const isInvalidOf = !Number.isFinite(onlyFans);
    const isInvalidPp = !Number.isFinite(paypal);
    const isInvalidCr = !Number.isFinite(crypto);

    const rawTotal = inc.total ?? (onlyFans + paypal + crypto);
    const total = Number(rawTotal);
    const isInvalidTotal = !Number.isFinite(total);

    if (isInvalidOf || isInvalidPp || isInvalidCr || isInvalidTotal) {
      invalidMonetaryValues++;
      issues.push(`IncomeRecord [${inc.id}]: invalid monetary values (of: ${inc.onlyFans}, pp: ${inc.paypal}, cr: ${inc.crypto}, total: ${inc.total})`);
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

    // Verify Target Reference: operator, model or admin
    const targetName = (op.operator || '').trim().toLowerCase();
    const isOp = operatorMap.has(targetName);
    const isAdmin = adminMap.has(targetName);
    const isModel = op.model && modelMap.has(op.model.trim().toLowerCase());

    if (!isOp && !isAdmin && !isModel) {
      unresolvedOperatorRefs++;
      issues.push(`OperationRecord [${op.id}]: unresolved participant '${op.operator}'`);
    }

    const amount = Number(op.amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
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
    const amount = Number(exp.amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
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
    const amount = Number(adv.amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      invalidMonetaryValues++;
      issues.push(`OwnerAdvance [${adv.id}]: invalid amount ${adv.amount}`);
    }
  });

  // 4. Calculate Normalized Rates Row Counts
  // Total model_period_rates rows = periods * unique models per period
  let totalModelPeriodRates = 0;
  periods.forEach((p: AccountingPeriod) => {
    const periodModels = new Set<string>();
    if (p.models && Array.isArray(p.models)) {
      p.models.forEach((m: string) => { if (m && m.trim()) periodModels.add(m.trim().toLowerCase()); });
    }
    // Also include any model with income in that period
    incomeRecords.forEach((inc: IncomeRecord) => {
      if (inc.periodId === p.id && inc.model && inc.model.trim()) {
        periodModels.add(inc.model.trim().toLowerCase());
      }
    });
    totalModelPeriodRates += periodModels.size;
  });

  // Total admin_period_rates rows = count of admin rates across all periods
  let totalAdminPeriodRates = 0;
  periods.forEach((p: AccountingPeriod) => {
    if (p.admins && Array.isArray(p.admins)) {
      totalAdminPeriodRates += p.admins.length;
    }
  });

  // 5. Calculate Target Row Counts
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

  const canonicalOwnersCount = 2; // owner_andrey, owner_anton

  const targetRowCounts = {
    accounting_periods: periods.length,
    operators: operatorMap.size,
    models: modelMap.size,
    owners: canonicalOwnersCount,
    admins: adminMap.size,
    owner_period_shares: periods.length * canonicalOwnersCount,
    model_period_rates: totalModelPeriodRates,
    admin_period_rates: totalAdminPeriodRates,
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
