import type { AppState, IncomeRecord, OperationRecord } from './types';

/** The commission already saved on income records remains the source for staff pay. */
export function calculateOperatorEarnings(incomes: IncomeRecord[], operations: OperationRecord[]) {
  const rawGross = incomes.reduce((sum, row) => sum + row.total, 0);
  const rawNet = incomes.reduce((sum, row) => sum + row.nettoOF + row.nettoPP + row.nettoCrypto, 0);
  const refunds = operations.filter(row => row.type === 'refund').reduce((sum, row) => sum + row.amount, 0);
  const lostCommission = refunds * (rawGross > 0 ? rawNet / rawGross : 0.20);
  return { rawGross, rawNet, refunds, lostCommission, gross: rawGross - refunds, net: rawNet - lostCommission };
}

export function calculateModelEarnings(records: IncomeRecord[], operations: OperationRecord[], rates: AppState['modelRates'], bonusTotal: number) {
  const refunds = operations.filter(row => row.type === 'refund');
  const grossOF = records.reduce((sum, row) => sum + row.onlyFans, 0);
  const grossPP = records.reduce((sum, row) => sum + row.paypal, 0);
  const grossCR = records.reduce((sum, row) => sum + row.crypto, 0);
  const totalGrossRaw = grossOF + grossPP + grossCR;
  const totalRefunds = refunds.reduce((sum, row) => sum + row.amount, 0);
  const platformRefund = (platform: string) => refunds.filter(row => row.platform === platform).reduce((sum, row) => sum + row.amount, 0);
  // Keep the existing Models policy: platform-specific commissions cannot go below zero.
  const earnOF = Math.max(0, grossOF - platformRefund('onlyFans')) * rates.of / 100;
  const earnPP = Math.max(0, grossPP - platformRefund('paypal')) * rates.pp / 100;
  const earnCR = Math.max(0, grossCR - platformRefund('crypto')) * rates.cr / 100;
  const genericRefunds = refunds.filter(row => !row.platform).reduce((sum, row) => sum + row.amount, 0);
  // A generic refund uses the original weighted rate, unaffected by other refunds.
  const rawCommission = (grossOF * rates.of + grossPP * rates.pp + grossCR * rates.cr) / 100;
  const averageRate = totalGrossRaw > 0 ? rawCommission / totalGrossRaw : rates.of / 100;
  return { grossOF, grossPP, grossCR, totalRefunds, totalGross: totalGrossRaw - totalRefunds,
    earnOF, earnPP, earnCR, bonusTotal, accruedSalary: earnOF + earnPP + earnCR + bonusTotal - genericRefunds * averageRate };
}

export function periodModelNames(state: AppState, periodId: string): string[] {
  const period = state.accountingPeriods.find(row => row.id === periodId);
  return [...new Set([
    ...(period?.models?.length ? period.models : state.models),
    ...state.incomeData.filter(row => row.periodId === periodId).map(row => row.model),
    ...(state.modelBonuses || []).filter(row => row.periodId === periodId).map(row => row.model),
    ...state.operationsData.filter(row => row.periodId === periodId).map(row => row.model),
  ])].filter((name): name is string => !!name);
}

export function periodOperatorNames(state: AppState, periodId: string): string[] {
  const period = state.accountingPeriods.find(row => row.id === periodId);
  const admins = period?.admins || state.admins, models = periodModelNames(state, periodId);
  return [...new Set([
    ...(period?.operators || state.operators),
    ...state.incomeData.filter(row => row.periodId === periodId).map(row => row.operator),
    ...state.operationsData.filter(row => row.periodId === periodId).map(row => row.operator),
  ])].filter(name => !!name && name !== 'SYSTEM' && !admins.some(admin => admin.name === name) && !models.includes(name));
}

/** One formula for an open period and for the previous-period comparison. Pure read. */
export function calculateOwnerFinancials(state: AppState, activePeriodId: string) {
  const activePeriod = state.accountingPeriods.find(period => period.id === activePeriodId);
  if (!activePeriod) throw new Error('Unknown accounting period');
  const currentModels = periodModelNames(state, activePeriodId);
  const currentAdmins = activePeriod.admins || state.admins;
  const currentRates = activePeriod.modelRates || state.modelRates;

    const incomes = state.incomeData.filter(r => r.periodId === activePeriodId);
    const manualIncomes = (state.ownerManualIncomes || []).filter(i => i.periodId === activePeriodId);
    const ops = state.operationsData.filter(o => o.periodId === activePeriodId);
    const modelBonuses = (state.modelBonuses || []).filter(b => b.periodId === activePeriodId);
    
    const rawPlatformGross = incomes.reduce((sum, r) => sum + r.total, 0);
    const manualGross = manualIncomes.reduce((sum, i) => sum + i.amount, 0);
    const totalRefundAmount = ops.filter(o => o.type === 'refund').reduce((s, o) => s + o.amount, 0);

    const grossTotal = (rawPlatformGross + manualGross) - totalRefundAmount;

    // 1. ОПЕРАТОРЫ (STAFF)
    const allPeriodOperators = periodOperatorNames(state, activePeriodId);

    let staffAccrued = 0;
    let staffPaid = 0;
    let staffRemainder = 0;

    allPeriodOperators.forEach(op => {
      const opIncomes = incomes.filter(r => r.operator === op);
      const opOps = ops.filter(o => o.operator === op && o.operator !== 'SYSTEM' && !o.model);

      const totalNet = calculateOperatorEarnings(opIncomes, ops.filter(o => o.operator === op)).net;

      const bns = opOps.filter(o => o.type === 'bonus').reduce((sum, o) => sum + o.amount, 0);
      const pnl = opOps.filter(o => o.type === 'penalty' || o.type === 'internship').reduce((sum, o) => sum + o.amount, 0);
      const adv = opOps.filter(o => o.type === 'advance').reduce((sum, o) => sum + o.amount, 0);
      const pay = opOps.filter(o => o.type === 'salary_payment').reduce((sum, o) => sum + o.amount, 0);

      const accrued = totalNet + bns - pnl;
      const paid = adv + pay;
      const remainder = accrued - paid;
      const isPaid = state.paidStatuses.some(s => s.entityName === op && s.entityType === 'operator' && s.periodId === activePeriodId);

      staffAccrued += accrued;
      staffPaid += paid;
      if (!isPaid && remainder > 0) {
        staffRemainder += remainder;
      }
    });

    // 2. МОДЕЛИ
    const modelSummary = currentModels.reduce((acc, model) => {
      const records = incomes.filter(r => r.model === model);
      const modelOps = ops.filter(o => o.model === model);
      const mAdvances = modelOps.filter(o => o.type === 'advance').reduce((s,o) => s + o.amount, 0);
      const mSalaries = modelOps.filter(o => o.type === 'salary_payment').reduce((s,o) => s + o.amount, 0);
      const mBonuses = modelBonuses.filter(b => b.model === model).reduce((s,b) => s + b.amount, 0);
      const accrued = calculateModelEarnings(records, modelOps, currentRates, mBonuses).accruedSalary;
      const paid = mAdvances + mSalaries;
      const remainder = accrued - paid;
      const isPaid = state.paidStatuses.some(s => s.entityName === model && s.entityType === 'model' && s.periodId === activePeriodId);

      acc.accrued += accrued;
      acc.paid += paid;
      if (!isPaid && remainder > 0) {
        acc.remainder += remainder;
      }
      return acc;
    }, { accrued: 0, paid: 0, remainder: 0 });

    // 3. АДМИНЫ
    const adminDetails = currentAdmins.map(admin => {
      const accrued = grossTotal * (admin.rate / 100);
      const paid = ops.filter(o => o.operator === admin.name && ['salary_payment', 'advance'].includes(o.type)).reduce((s, o) => s + o.amount, 0);
      const remainder = accrued - paid;
      const isPaid = state.paidStatuses.some(s => s.entityName === admin.name && s.entityType === 'admin' && s.periodId === activePeriodId);
      return { ...admin, accrued, paid, remainder: isPaid ? 0 : Math.max(0, remainder) };
    });

    const totalAdminAccrued = adminDetails.reduce((s, a) => s + a.accrued, 0);
    const totalAdminPaid = adminDetails.reduce((s, a) => s + a.paid, 0);
    const adminRemainder = adminDetails.reduce((s, a) => s + a.remainder, 0);

    const currentExpenses = state.ownerExpenses.filter(e => e.periodId === activePeriodId);
    const bizExpenses = currentExpenses.reduce((s,e) => s + e.amount, 0);
    
    const trafficTotal = currentExpenses.filter(e => e.category === 'traffic').reduce((s, e) => s + e.amount, 0);
    const commissionTotal = currentExpenses.filter(e => e.category === 'commission').reduce((s, e) => s + e.amount, 0);
    
    // Чистая прибыль
    const netProfitTotal = grossTotal - (staffAccrued + modelSummary.accrued + totalAdminAccrued + bizExpenses);
    const sharePerOwner = netProfitTotal / 2;

    const modelRemainder = modelSummary.remainder;

    const totalPaidGlobal = staffPaid + modelSummary.paid + totalAdminPaid;
    const totalRemainderGlobal = staffRemainder + modelRemainder + adminRemainder;

    return { 
      grossTotal, rawPlatformGross, manualGross, totalRefundAmount,
      netProfitTotal, sharePerOwner,
      staffAccrued, staffPaid, staffRemainder,
      modelAccrued: modelSummary.accrued, modelPaid: modelSummary.paid, modelRemainder,
      adminAccrued: totalAdminAccrued, adminPaid: totalAdminPaid, adminRemainder,
      adminDetails,
      totalPaidGlobal, totalRemainderGlobal,
      bizExpenses,
      trafficTotal,
      commissionTotal,
      currentExpenses,
      currentManualIncomes: (state.ownerManualIncomes || []).filter(i => i.periodId === activePeriodId),
      currentOwnerAdvances: (state.ownerAdvances || []).filter(a => a.periodId === activePeriodId),
      andrey: { totalShare: sharePerOwner, advances: (state.ownerAdvances || []).filter(a => a.periodId === activePeriodId && a.ownerName === 'Andrey').reduce((s, a) => s + a.amount, 0) },
      anton: { totalShare: sharePerOwner, advances: (state.ownerAdvances || []).filter(a => a.periodId === activePeriodId && a.ownerName === 'Anton').reduce((s, a) => s + a.amount, 0) },
    };

}
