/**
 * DRY RUN MIGRATION & RECONCILIATION SCRIPT (PHASE 2)
 *
 * Reads app_storage.main without writing anything to DB.
 * Uses the exact shared transformation engine (RelationalTransformer)
 * and validates entity resolution, relational constraints, and 100% financial parity.
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
import {
  transformAppStateToRelational,
  RelationalMigrationPayload,
  EntityMappingContext,
} from './relational_transformer';
import {
  runPostMigrationReconciliation,
  ReconciliationReport,
} from './post_migration_reconciliation';

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
  reconciliation?: ReconciliationReport;
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

  // 2. Transform via pure shared transformation engine
  const { payload, context, warnings } = transformAppStateToRelational(state);
  warnings.forEach(w => issues.push(w));

  const { operatorMap, modelMap, ownerMap, adminMap, periodIds } = context;

  // 3. Validation & Reference Resolution Checks on Source Records
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

  // Check Roster Shift Models Invariant & Uniqueness
  const expectedRosterModelsCount = roster.reduce((sum, r) => {
    if (r.models && Array.isArray(r.models)) {
      const uniqueCleanModels = new Set(r.models.map(m => (m || '').trim().toLowerCase()).filter(Boolean));
      return sum + uniqueCleanModels.size;
    }
    return sum;
  }, 0);

  if (payload.roster_shift_models.length !== expectedRosterModelsCount) {
    issues.push(`Invariant violation: roster_shift_models payload count (${payload.roster_shift_models.length}) !== source clean models count (${expectedRosterModelsCount})`);
  }

  const seenRosterJunction = new Set<string>();
  payload.roster_shift_models.forEach(rsm => {
    const key = `${rsm.roster_shift_id}:${rsm.model_id}`;
    if (seenRosterJunction.has(key)) {
      duplicateBusinessKeys++;
      uniqueConstraintConflicts++;
      issues.push(`Duplicate roster_shift_models composite key: ${key}`);
    }
    seenRosterJunction.add(key);
  });

  // 4. Target Row Counts directly from Payload
  const targetRowCounts = {
    accounting_periods: payload.accounting_periods.length,
    operators: payload.operators.length,
    models: payload.models.length,
    owners: payload.owners.length,
    admins: payload.admins.length,
    owner_period_shares: payload.owner_period_shares.length,
    model_period_rates: payload.model_period_rates.length,
    admin_period_rates: payload.admin_period_rates.length,
    income_records: payload.income_records.length,
    financial_operations: payload.financial_operations.length,
    agency_transactions: payload.agency_transactions.length,
    owner_draws: payload.owner_draws.length,
    model_period_bonuses: payload.model_period_bonuses.length,
    payout_settlement_flags: payload.payout_settlement_flags.length,
    model_monthly_plans: payload.model_monthly_plans.length,
    shift_balance_entries: payload.shift_balance_entries.length,
    roster_shifts: payload.roster_shifts.length,
    roster_shift_models: payload.roster_shift_models.length,
  };

  // 5. 100% Financial Reconciliation across all periods
  const reconciliation = runPostMigrationReconciliation(state, payload, context);
  if (!reconciliation.isPassed) {
    reconciliation.issues.forEach(iss => issues.push(iss));
  }

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
    reconciliation,
    issues,
    isPassed: issues.length === 0 && reconciliation.isPassed,
  };
}
