import type { AppState } from './types';
import { manualIncomeTotal } from './stateAccess';
import { calculateOperatorEarnings, periodOperatorNames, isOperatorPayrollOperation } from './financialCalculations';

/** Existing Dashboard calculation, shared by the overview and payroll screens. */
export function dashboardSummary(state: AppState, activePeriodId: string) {
  const activePeriod = state.accountingPeriods.find(p => p.id === activePeriodId);
  const currentOperators = periodOperatorNames(state, activePeriodId);
    const periodIncomes = state.incomeData.filter(r => r.periodId === activePeriodId);
    const periodOps = state.operationsData.filter(o => o.periodId === activePeriodId);
    const currentAdmins = activePeriod?.admins || state.admins;
    const adminNames = currentAdmins.map(a => a.name);
    
    const rawPlatformGross = periodIncomes.reduce((s, r) => s + r.total, 0);
    const rawManualGross = manualIncomeTotal(state, activePeriodId);
    const totalRefunds = periodOps.filter(o => o.type === 'refund').reduce((s, o) => s + o.amount, 0);
    
    const totalGross = (rawPlatformGross + rawManualGross) - totalRefunds;
    const netEarned = currentOperators.reduce((sum, operator) => sum + calculateOperatorEarnings(
      periodIncomes.filter(row => row.operator === operator), periodOps.filter(row => row.operator === operator)
    ).net, 0);

    // --- Калькуляция прогноза ---
    const getAccountingDateUTC = () => {
      const now = new Date();
      const kyivStr = now.toLocaleString("en-US", { timeZone: "Europe/Kiev", hour12: false });
      const [datePart, timePart] = kyivStr.split(', ');
      const [m, d, y] = datePart.split('/').map(Number);
      const [h] = timePart.split(':').map(Number);
      const date = new Date(Date.UTC(y, m - 1, d));
      if (h < 3) date.setUTCDate(date.getUTCDate() - 1);
      return date;
    };
    
    const accountingDate = getAccountingDateUTC();
    const sortedPeriodsForLatest = [...state.accountingPeriods].sort((a, b) => 
      new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
    );
    const isLatestPeriod = sortedPeriodsForLatest[sortedPeriodsForLatest.length - 1]?.id === activePeriodId;

    let targetMonth: number;
    let targetYear: number;
    if (activePeriod) {
      const pStart = new Date(activePeriod.startAt);
      targetMonth = pStart.getUTCMonth();
      targetYear = pStart.getUTCFullYear();
    } else {
      targetMonth = accountingDate.getUTCMonth();
      targetYear = accountingDate.getUTCFullYear();
    }

    const totalDaysInMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
    const daysPassed = isLatestPeriod ? accountingDate.getUTCDate() : totalDaysInMonth;
    const runRate = totalGross / Math.max(daysPassed, 1);
    const forecast = Math.max(totalGross, runRate * totalDaysInMonth);

    // --- Калькуляция Плана ---
    const activeModels = (activePeriod?.models && activePeriod.models.length > 0) ? activePeriod.models : state.models;
    const totalTarget = activeModels.reduce((sum, mName) => {
      const mGoal = activePeriod?.modelMonthlyPlans?.[mName] || state.modelMonthlyPlans?.[mName] || 0;
      return sum + mGoal;
    }, 0);

    const totals = { 
      totalGross, platformGross: rawPlatformGross, manualGross: rawManualGross,
      netEarned,
      bonuses: 0, penalties: 0, refunds: totalRefunds, advances: 0, paidOut: 0, remainder: 0,
      forecast, totalTarget, 
      adminDetails: [] as { name: string, amount: number, rate: number }[],
      of: { gross: 0, net: 0 }, pp: { gross: 0, net: 0 }, cr: { gross: 0, net: 0 } 
    };

    periodIncomes.forEach(r => {
      totals.of.gross += r.onlyFans; totals.of.net += r.nettoOF;
      totals.pp.gross += r.paypal; totals.pp.net += r.nettoPP;
      totals.cr.gross += r.crypto; totals.cr.net += r.nettoCrypto;
    });

    periodOps.forEach(op => {
      const isOperator = currentOperators.includes(op.operator) && !adminNames.includes(op.operator) && isOperatorPayrollOperation(op, op.operator);
      if (isOperator) {
        if (op.type === 'bonus') totals.bonuses += op.amount;
        else if (op.type === 'penalty' || op.type === 'internship') totals.penalties += op.amount;
        else if (op.type === 'advance') { totals.advances += op.amount; totals.paidOut += op.amount; }
        else if (op.type === 'salary_payment') totals.paidOut += op.amount;
      }
    });

    totals.remainder = Math.max(0, (totals.netEarned + totals.bonuses) - (totals.penalties + totals.paidOut));
    currentAdmins.forEach(admin => { totals.adminDetails.push({ name: admin.name, amount: totalGross * (admin.rate / 100), rate: admin.rate }); });
    return totals;
}
