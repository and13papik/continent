/**
 * POST-MIGRATION RECONCILIATION MODULE
 * 
 * Conducts 1:1 financial & referential parity checks between source AppState
 * and migrated Relational Database tables / views.
 * 
 * Reconciles EVERY accounting period on:
 * - Agency Gross
 * - Staff Pool (Accrued, Paid, Remainder)
 * - Model Pool (Accrued, Paid, Remainder)
 * - Admin Pool (Accrued, Paid, Remainder)
 * - Agency Expenses
 * - Net Agency Profit
 * - Owner Shares, Draws, Remaining
 */

import { AppState, AccountingPeriod } from '../types';
import { RelationalMigrationPayload, EntityMappingContext } from './relational_transformer';

export interface PeriodFinancialComparison {
  periodId: string;
  periodLabel: string;
  source: {
    grossTotal: number;
    staffPool: number;
    staffPaid: number;
    staffRemainder: number;
    modelPool: number;
    modelPaid: number;
    modelRemainder: number;
    adminPool: number;
    adminPaid: number;
    adminRemainder: number;
    agencyExpenses: number;
    netProfit: number;
    andreyShare: number;
    andreyDraws: number;
    andreyRemaining: number;
    antonShare: number;
    antonDraws: number;
    antonRemaining: number;
  };
  target: {
    grossTotal: number;
    staffPool: number;
    staffPaid: number;
    staffRemainder: number;
    modelPool: number;
    modelPaid: number;
    modelRemainder: number;
    adminPool: number;
    adminPaid: number;
    adminRemainder: number;
    agencyExpenses: number;
    netProfit: number;
    andreyShare: number;
    andreyDraws: number;
    andreyRemaining: number;
    antonShare: number;
    antonDraws: number;
    antonRemaining: number;
  };
  differences: {
    grossTotalDiff: number;
    staffPoolDiff: number;
    staffPaidDiff: number;
    staffRemainderDiff: number;
    modelPoolDiff: number;
    modelPaidDiff: number;
    modelRemainderDiff: number;
    adminPoolDiff: number;
    adminPaidDiff: number;
    adminRemainderDiff: number;
    agencyExpensesDiff: number;
    netProfitDiff: number;
    andreyShareDiff: number;
    andreyDrawsDiff: number;
    andreyRemainingDiff: number;
    antonShareDiff: number;
    antonDrawsDiff: number;
    antonRemainingDiff: number;
  };
  isMatch: boolean;
}

export interface ReconciliationReport {
  isPassed: boolean;
  totalPeriodsChecked: number;
  periodsWithDiscrepancies: number;
  periodReports: PeriodFinancialComparison[];
  referentialIntegrity: {
    orphanIncomePeriodRefs: number;
    orphanIncomeOperatorRefs: number;
    orphanIncomeModelRefs: number;
    orphanOperationPeriodRefs: number;
    orphanOperationTargetRefs: number;
    orphanAgencyTxPeriodRefs: number;
    orphanOwnerDrawPeriodRefs: number;
    orphanOwnerDrawOwnerRefs: number;
    orphanBonusPeriodRefs: number;
    orphanBonusModelRefs: number;
    orphanFlagPeriodRefs: number;
    orphanRosterOperatorRefs: number;
    orphanRosterModelRefs: number;
    totalOrphans: number;
  };
  duplicateKeyIssues: string[];
  issues: string[];
}

export function round2(val: number): number {
  return Math.round((Number(val || 0) + Number.EPSILON) * 100) / 100;
}

function areClose(a: number, b: number): boolean {
  return round2(a) === round2(b);
}

/**
 * 1. Compute Legacy Source Financials for a given Period
 */
export function computeSourcePeriodFinancials(state: AppState, periodId: string) {
  const period = state.accountingPeriods.find(p => p.id === periodId);
  const currentRates = period?.modelRates || state.modelRates || { of: 20, pp: 20, cr: 20 };
  const currentModels = period?.models || state.models || [];
  const currentAdmins = period?.admins || state.admins || [];
  const currentOperators = period?.operators || state.operators || [];

  const incomes = (state.incomeData || []).filter(r => r.periodId === periodId);
  const manualIncomes = (state.ownerManualIncomes || []).filter(i => i.periodId === periodId);
  const ops = (state.operationsData || []).filter(o => o.periodId === periodId);
  const modelBonuses = (state.modelBonuses || []).filter(b => b.periodId === periodId);
  const currentExpenses = (state.ownerExpenses || []).filter(e => e.periodId === periodId);
  const ownerAdvances = (state.ownerAdvances || []).filter(a => a.periodId === periodId);
  const paidStatuses = (state.paidStatuses || []).filter(s => s.periodId === periodId);

  const rawPlatformGross = incomes.reduce((sum, r) => sum + (r.total || (r.onlyFans || 0) + (r.paypal || 0) + (r.crypto || 0)), 0);
  const manualGross = manualIncomes.reduce((sum, i) => sum + i.amount, 0);
  const totalRefundAmount = ops.filter(o => o.type === 'refund').reduce((s, o) => s + o.amount, 0);
  const grossTotal = (rawPlatformGross + manualGross) - totalRefundAmount;

  // 1. Staff (Operators)
  const allPeriodOperators = Array.from(new Set([
    ...currentOperators,
    ...incomes.map(i => i.operator).filter(Boolean),
    ...ops.map(o => o.operator).filter(Boolean)
  ])).filter(name => name !== 'SYSTEM' && !currentAdmins.some(a => a.name === name) && !currentModels.includes(name));

  let staffAccrued = 0;
  let staffPaid = 0;
  let staffRemainder = 0;

  allPeriodOperators.forEach(op => {
    const opIncomes = incomes.filter(r => r.operator === op);
    const opOps = ops.filter(o => o.operator === op && o.operator !== 'SYSTEM' && !o.model);

    const rawG = opIncomes.reduce((sum, r) => sum + (r.total || (r.onlyFans || 0) + (r.paypal || 0) + (r.crypto || 0)), 0);
    const rawN = opIncomes.reduce((sum, r) => sum + (r.nettoOF + r.nettoPP + r.nettoCrypto), 0);
    const opRefunds = ops.filter(o => o.type === 'refund' && o.operator === op).reduce((sum, o) => sum + o.amount, 0);

    const avgRate = rawG > 0 ? rawN / rawG : 0.20;
    const totalNet = rawN - (opRefunds * avgRate);

    const bns = opOps.filter(o => o.type === 'bonus').reduce((sum, o) => sum + o.amount, 0);
    const pnl = opOps.filter(o => o.type === 'penalty' || o.type === 'internship').reduce((sum, o) => sum + o.amount, 0);
    const adv = opOps.filter(o => o.type === 'advance').reduce((sum, o) => sum + o.amount, 0);
    const pay = opOps.filter(o => o.type === 'salary_payment').reduce((sum, o) => sum + o.amount, 0);

    const accrued = totalNet + bns - pnl;
    const paid = adv + pay;
    const remainder = accrued - paid;
    const isPaid = paidStatuses.some(s => s.entityName === op && s.entityType === 'operator');

    staffAccrued += accrued;
    staffPaid += paid;
    if (!isPaid && remainder > 0) {
      staffRemainder += remainder;
    }
  });

  // 2. Models
  const allPeriodModels = Array.from(new Set([
    ...currentModels,
    ...incomes.map(i => i.model).filter(Boolean)
  ]));

  let modelAccrued = 0;
  let modelPaid = 0;
  let modelRemainder = 0;

  allPeriodModels.forEach(model => {
    const records = incomes.filter(r => r.model === model);
    const mOF = records.reduce((s, r) => s + (r.onlyFans || 0), 0) * (currentRates.of / 100);
    const mPP = records.reduce((s, r) => s + (r.paypal || 0), 0) * (currentRates.pp / 100);
    const mCR = records.reduce((s, r) => s + (r.crypto || 0), 0) * (currentRates.cr / 100);
    const mRefunds = ops.filter(o => o.type === 'refund' && o.model === model).reduce((s, o) => s + o.amount, 0);
    const mAdvances = ops.filter(o => o.type === 'advance' && o.model === model).reduce((s, o) => s + o.amount, 0);
    const mSalaries = ops.filter(o => o.type === 'salary_payment' && o.model === model).reduce((s, o) => s + o.amount, 0);
    const mBonuses = modelBonuses.filter(b => b.model === model).reduce((s, b) => s + b.amount, 0);
    const mTotalGross = records.reduce((s, r) => s + (r.total || (r.onlyFans || 0) + (r.paypal || 0) + (r.crypto || 0)), 0);
    const mAvgRate = mTotalGross > 0 ? (mOF + mPP + mCR) / mTotalGross : (currentRates.of / 100);

    const accrued = (mOF + mPP + mCR + mBonuses) - (mRefunds * mAvgRate);
    const paid = mAdvances + mSalaries;
    const remainder = accrued - paid;
    const isPaid = paidStatuses.some(s => s.entityName === model && s.entityType === 'model');

    modelAccrued += accrued;
    modelPaid += paid;
    if (!isPaid && remainder > 0) {
      modelRemainder += remainder;
    }
  });

  // 3. Admins
  let adminAccrued = 0;
  let adminPaid = 0;
  let adminRemainder = 0;

  currentAdmins.forEach(admin => {
    const accrued = grossTotal * (admin.rate / 100);
    const paid = ops.filter(o => o.operator === admin.name && ['salary_payment', 'advance'].includes(o.type)).reduce((s, o) => s + o.amount, 0);
    const remainder = accrued - paid;
    const isPaid = paidStatuses.some(s => s.entityName === admin.name && s.entityType === 'admin');

    adminAccrued += accrued;
    adminPaid += paid;
    if (!isPaid && remainder > 0) {
      adminRemainder += remainder;
    }
  });

  // 4. Expenses & Net Profit
  const bizExpenses = currentExpenses.reduce((s, e) => s + e.amount, 0);
  const netProfit = grossTotal - (staffAccrued + modelAccrued + adminAccrued + bizExpenses);
  const sharePerOwner = netProfit / 2;

  const andreyAdvances = ownerAdvances.filter(a => ['andrey', 'андрей'].includes((a.ownerName || '').toLowerCase())).reduce((s, a) => s + a.amount, 0);
  const antonAdvances = ownerAdvances.filter(a => ['anton', 'антон'].includes((a.ownerName || '').toLowerCase())).reduce((s, a) => s + a.amount, 0);

  return {
    grossTotal,
    staffPool: staffAccrued,
    staffPaid,
    staffRemainder,
    modelPool: modelAccrued,
    modelPaid,
    modelRemainder,
    adminPool: adminAccrued,
    adminPaid,
    adminRemainder,
    agencyExpenses: bizExpenses,
    netProfit,
    andreyShare: sharePerOwner,
    andreyDraws: andreyAdvances,
    andreyRemaining: sharePerOwner - andreyAdvances,
    antonShare: sharePerOwner,
    antonDraws: antonAdvances,
    antonRemaining: sharePerOwner - antonAdvances,
  };
}

/**
 * 2. Compute Relational View Financials for a given Period from Payload
 */
export function computeRelationalPeriodFinancials(payload: RelationalMigrationPayload, periodId: string) {
  const incomes = payload.income_records.filter(r => r.period_id === periodId);
  const manualIncomes = payload.agency_transactions.filter(t => t.period_id === periodId && t.direction === 'income');
  const expenses = payload.agency_transactions.filter(t => t.period_id === periodId && t.direction === 'expense');
  const ops = payload.financial_operations.filter(o => o.period_id === periodId);
  const modelBonuses = payload.model_period_bonuses.filter(b => b.period_id === periodId);
  const settlementFlags = payload.payout_settlement_flags.filter(f => f.period_id === periodId && f.is_settled);
  const ownerDraws = payload.owner_draws.filter(d => d.period_id === periodId);
  const modelRates = payload.model_period_rates.filter(r => r.period_id === periodId);
  const adminRates = payload.admin_period_rates.filter(r => r.period_id === periodId);

  const primaryGross = incomes.reduce((s, r) => s + (r.onlyfans_gross + r.paypal_gross + r.crypto_gross), 0);
  const manualGross = manualIncomes.reduce((s, i) => s + i.amount, 0);
  const refundAmount = ops.filter(o => o.type === 'refund').reduce((s, o) => s + o.amount, 0);
  const grossTotal = (primaryGross + manualGross) - refundAmount;

  // 1. Staff (Operators)
  const operatorIds = Array.from(new Set([
    ...incomes.map(i => i.operator_id),
    ...ops.filter(o => o.target_type === 'operator' && o.operator_id).map(o => o.operator_id!)
  ]));

  let staffPool = 0;
  let staffPaid = 0;
  let staffRemainder = 0;

  operatorIds.forEach(opId => {
    const opIncomes = incomes.filter(i => i.operator_id === opId);
    const opOps = ops.filter(o => o.target_type === 'operator' && o.operator_id === opId);

    const shiftNet = opIncomes.reduce((s, r) => s + ((r.netto_of ?? 0) + (r.netto_pp ?? 0) + (r.netto_crypto ?? 0)), 0);
    const shiftGross = opIncomes.reduce((s, r) => s + (r.onlyfans_gross + r.paypal_gross + r.crypto_gross), 0);
    const opRefunds = ops.filter(o => o.type === 'refund' && o.operator_id === opId).reduce((s, o) => s + o.amount, 0);

    const avgRate = shiftGross > 0 ? shiftNet / shiftGross : 0.20;
    const totalNet = shiftNet - (opRefunds * avgRate);

    const bns = opOps.filter(o => o.type === 'bonus').reduce((s, o) => s + o.amount, 0);
    const pnl = opOps.filter(o => o.type === 'penalty' || o.type === 'internship').reduce((s, o) => s + o.amount, 0);
    const adv = opOps.filter(o => o.type === 'advance').reduce((s, o) => s + o.amount, 0);
    const pay = opOps.filter(o => o.type === 'salary_payment').reduce((s, o) => s + o.amount, 0);

    const accrued = totalNet + bns - pnl;
    const paid = adv + pay;
    const remainder = accrued - paid;
    const isSettled = settlementFlags.some(f => f.target_type === 'operator' && f.operator_id === opId);

    staffPool += accrued;
    staffPaid += paid;
    if (!isSettled && remainder > 0) {
      staffRemainder += remainder;
    }
  });

  // 2. Models
  const modelIds = Array.from(new Set([
    ...modelRates.map(r => r.model_id),
    ...incomes.map(i => i.model_id)
  ]));

  let modelPool = 0;
  let modelPaid = 0;
  let modelRemainder = 0;

  modelIds.forEach(mId => {
    const mIncomes = incomes.filter(i => i.model_id === mId);
    const mOps = ops.filter(o => o.target_type === 'model' && o.model_id === mId);
    const mBonuses = modelBonuses.filter(b => b.model_id === mId).reduce((s, b) => s + b.amount, 0);
    const rates = modelRates.find(r => r.model_id === mId) || { rate_of: 20, rate_pp: 20, rate_crypto: 20 };

    const ofGross = mIncomes.reduce((s, i) => s + i.onlyfans_gross, 0);
    const ppGross = mIncomes.reduce((s, i) => s + i.paypal_gross, 0);
    const crGross = mIncomes.reduce((s, i) => s + i.crypto_gross, 0);
    const totGross = ofGross + ppGross + crGross;

    const mOF = ofGross * (rates.rate_of / 100);
    const mPP = ppGross * (rates.rate_pp / 100);
    const mCR = crGross * (rates.rate_crypto / 100);

    const mRefunds = ops.filter(o => o.type === 'refund' && o.model_id === mId).reduce((s, o) => s + o.amount, 0);
    const mAvgRate = totGross > 0 ? (mOF + mPP + mCR) / totGross : (rates.rate_of / 100);

    const accrued = (mOF + mPP + mCR + mBonuses) - (mRefunds * mAvgRate);
    const adv = mOps.filter(o => o.type === 'advance').reduce((s, o) => s + o.amount, 0);
    const pay = mOps.filter(o => o.type === 'salary_payment').reduce((s, o) => s + o.amount, 0);
    const paid = adv + pay;
    const remainder = accrued - paid;
    const isSettled = settlementFlags.some(f => f.target_type === 'model' && f.model_id === mId);

    modelPool += accrued;
    modelPaid += paid;
    if (!isSettled && remainder > 0) {
      modelRemainder += remainder;
    }
  });

  // 3. Admins
  let adminPool = 0;
  let adminPaid = 0;
  let adminRemainder = 0;

  adminRates.forEach(ar => {
    const accrued = grossTotal * (ar.rate_percent / 100);
    const paid = ops.filter(o => o.target_type === 'admin' && o.admin_id === ar.admin_id && ['salary_payment', 'advance'].includes(o.type)).reduce((s, o) => s + o.amount, 0);
    const remainder = accrued - paid;
    const isSettled = settlementFlags.some(f => f.target_type === 'admin' && f.admin_id === ar.admin_id);

    adminPool += accrued;
    adminPaid += paid;
    if (!isSettled && remainder > 0) {
      adminRemainder += remainder;
    }
  });

  // 4. Expenses & Net Profit
  const agencyExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const netProfit = grossTotal - (staffPool + modelPool + adminPool + agencyExpenses);
  const sharePerOwner = netProfit / 2;

  const andreyDraws = ownerDraws.filter(d => d.owner_id === 'owner_andrey').reduce((s, d) => s + d.amount, 0);
  const antonDraws = ownerDraws.filter(d => d.owner_id === 'owner_anton').reduce((s, d) => s + d.amount, 0);

  return {
    grossTotal,
    staffPool,
    staffPaid,
    staffRemainder,
    modelPool,
    modelPaid,
    modelRemainder,
    adminPool,
    adminPaid,
    adminRemainder,
    agencyExpenses,
    netProfit,
    andreyShare: sharePerOwner,
    andreyDraws,
    andreyRemaining: sharePerOwner - andreyDraws,
    antonShare: sharePerOwner,
    antonDraws,
    antonRemaining: sharePerOwner - antonDraws,
  };
}

/**
 * 3. Run Full Post-Migration Reconciliation & Integrity Audit
 */
export function runPostMigrationReconciliation(
  state: AppState,
  payload: RelationalMigrationPayload,
  context: EntityMappingContext
): ReconciliationReport {
  const issues: string[] = [];
  const duplicateKeyIssues: string[] = [];
  const periodReports: PeriodFinancialComparison[] = [];

  const periodIdSet = new Set(payload.accounting_periods.map(p => p.id));
  const operatorIdSet = new Set(payload.operators.map(o => o.id));
  const modelIdSet = new Set(payload.models.map(m => m.id));
  const adminIdSet = new Set(payload.admins.map(a => a.id));
  const ownerIdSet = new Set(payload.owners.map(o => o.id));

  // A. Referential Integrity Checks
  let orphanIncomePeriodRefs = 0;
  let orphanIncomeOperatorRefs = 0;
  let orphanIncomeModelRefs = 0;
  let orphanOperationPeriodRefs = 0;
  let orphanOperationTargetRefs = 0;
  let orphanAgencyTxPeriodRefs = 0;
  let orphanOwnerDrawPeriodRefs = 0;
  let orphanOwnerDrawOwnerRefs = 0;
  let orphanBonusPeriodRefs = 0;
  let orphanBonusModelRefs = 0;
  let orphanFlagPeriodRefs = 0;
  let orphanRosterOperatorRefs = 0;
  let orphanRosterModelRefs = 0;

  payload.income_records.forEach(r => {
    if (!periodIdSet.has(r.period_id)) orphanIncomePeriodRefs++;
    if (!operatorIdSet.has(r.operator_id)) orphanIncomeOperatorRefs++;
    if (!modelIdSet.has(r.model_id)) orphanIncomeModelRefs++;
  });

  payload.financial_operations.forEach(o => {
    if (!periodIdSet.has(o.period_id)) orphanOperationPeriodRefs++;
    if (o.target_type === 'operator' && (!o.operator_id || !operatorIdSet.has(o.operator_id))) orphanOperationTargetRefs++;
    if (o.target_type === 'model' && (!o.model_id || !modelIdSet.has(o.model_id))) orphanOperationTargetRefs++;
    if (o.target_type === 'admin' && (!o.admin_id || !adminIdSet.has(o.admin_id))) orphanOperationTargetRefs++;
  });

  payload.agency_transactions.forEach(t => {
    if (!periodIdSet.has(t.period_id)) orphanAgencyTxPeriodRefs++;
  });

  payload.owner_draws.forEach(d => {
    if (!periodIdSet.has(d.period_id)) orphanOwnerDrawPeriodRefs++;
    if (!ownerIdSet.has(d.owner_id)) orphanOwnerDrawOwnerRefs++;
  });

  payload.model_period_bonuses.forEach(b => {
    if (!periodIdSet.has(b.period_id)) orphanBonusPeriodRefs++;
    if (!modelIdSet.has(b.model_id)) orphanBonusModelRefs++;
  });

  payload.payout_settlement_flags.forEach(f => {
    if (!periodIdSet.has(f.period_id)) orphanFlagPeriodRefs++;
  });

  payload.roster_shifts.forEach(r => {
    if (!operatorIdSet.has(r.operator_id)) orphanRosterOperatorRefs++;
  });

  payload.roster_shift_models.forEach(rm => {
    if (!modelIdSet.has(rm.model_id)) orphanRosterModelRefs++;
  });

  const totalOrphans =
    orphanIncomePeriodRefs + orphanIncomeOperatorRefs + orphanIncomeModelRefs +
    orphanOperationPeriodRefs + orphanOperationTargetRefs +
    orphanAgencyTxPeriodRefs + orphanOwnerDrawPeriodRefs + orphanOwnerDrawOwnerRefs +
    orphanBonusPeriodRefs + orphanBonusModelRefs + orphanFlagPeriodRefs +
    orphanRosterOperatorRefs + orphanRosterModelRefs;

  if (totalOrphans > 0) {
    issues.push(`Referential integrity violation: ${totalOrphans} orphan foreign key references detected`);
  }

  // B. Financial Parity Checks Period by Period
  let periodsWithDiscrepancies = 0;
  const periods = state.accountingPeriods || [];

  periods.forEach((p: AccountingPeriod) => {
    const src = computeSourcePeriodFinancials(state, p.id);
    const tgt = computeRelationalPeriodFinancials(payload, p.id);

    const diff = {
      grossTotalDiff: round2(tgt.grossTotal - src.grossTotal),
      staffPoolDiff: round2(tgt.staffPool - src.staffPool),
      staffPaidDiff: round2(tgt.staffPaid - src.staffPaid),
      staffRemainderDiff: round2(tgt.staffRemainder - src.staffRemainder),
      modelPoolDiff: round2(tgt.modelPool - src.modelPool),
      modelPaidDiff: round2(tgt.modelPaid - src.modelPaid),
      modelRemainderDiff: round2(tgt.modelRemainder - src.modelRemainder),
      adminPoolDiff: round2(tgt.adminPool - src.adminPool),
      adminPaidDiff: round2(tgt.adminPaid - src.adminPaid),
      adminRemainderDiff: round2(tgt.adminRemainder - src.adminRemainder),
      agencyExpensesDiff: round2(tgt.agencyExpenses - src.agencyExpenses),
      netProfitDiff: round2(tgt.netProfit - src.netProfit),
      andreyShareDiff: round2(tgt.andreyShare - src.andreyShare),
      andreyDrawsDiff: round2(tgt.andreyDraws - src.andreyDraws),
      andreyRemainingDiff: round2(tgt.andreyRemaining - src.andreyRemaining),
      antonShareDiff: round2(tgt.antonShare - src.antonShare),
      antonDrawsDiff: round2(tgt.antonDraws - src.antonDraws),
      antonRemainingDiff: round2(tgt.antonRemaining - src.antonRemaining),
    };

    const isMatch =
      areClose(src.grossTotal, tgt.grossTotal) &&
      areClose(src.staffPool, tgt.staffPool) &&
      areClose(src.staffPaid, tgt.staffPaid) &&
      areClose(src.staffRemainder, tgt.staffRemainder) &&
      areClose(src.modelPool, tgt.modelPool) &&
      areClose(src.modelPaid, tgt.modelPaid) &&
      areClose(src.modelRemainder, tgt.modelRemainder) &&
      areClose(src.adminPool, tgt.adminPool) &&
      areClose(src.adminPaid, tgt.adminPaid) &&
      areClose(src.adminRemainder, tgt.adminRemainder) &&
      areClose(src.agencyExpenses, tgt.agencyExpenses) &&
      areClose(src.netProfit, tgt.netProfit) &&
      areClose(src.andreyShare, tgt.andreyShare) &&
      areClose(src.andreyDraws, tgt.andreyDraws) &&
      areClose(src.andreyRemaining, tgt.andreyRemaining) &&
      areClose(src.antonShare, tgt.antonShare) &&
      areClose(src.antonDraws, tgt.antonDraws) &&
      areClose(src.antonRemaining, tgt.antonRemaining);

    if (!isMatch) {
      periodsWithDiscrepancies++;
      issues.push(`Financial mismatch in period '${p.label}' [${p.id}]: net profit diff=${diff.netProfitDiff.toFixed(2)}, staff diff=${diff.staffPoolDiff.toFixed(2)}, model diff=${diff.modelPoolDiff.toFixed(2)}`);
    }

    periodReports.push({
      periodId: p.id,
      periodLabel: p.label,
      source: src,
      target: tgt,
      differences: diff,
      isMatch,
    });
  });

  return {
    isPassed: issues.length === 0 && periodsWithDiscrepancies === 0 && totalOrphans === 0,
    totalPeriodsChecked: periods.length,
    periodsWithDiscrepancies,
    periodReports,
    referentialIntegrity: {
      orphanIncomePeriodRefs,
      orphanIncomeOperatorRefs,
      orphanIncomeModelRefs,
      orphanOperationPeriodRefs,
      orphanOperationTargetRefs,
      orphanAgencyTxPeriodRefs,
      orphanOwnerDrawPeriodRefs,
      orphanOwnerDrawOwnerRefs,
      orphanBonusPeriodRefs,
      orphanBonusModelRefs,
      orphanFlagPeriodRefs,
      orphanRosterOperatorRefs,
      orphanRosterModelRefs,
      totalOrphans,
    },
    duplicateKeyIssues,
    issues,
  };
}
