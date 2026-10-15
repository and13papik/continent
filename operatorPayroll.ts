import type { AppState } from './types';
import { calculateOperatorEarnings, periodOperatorNames, operatorPayrollOperations } from './financialCalculations';

/** Preserve the former Dashboard ledger, including refunds, paid markers and row order. */
export function operatorPayrollRows(state: AppState, activePeriodId: string) {
  const currentOperators = periodOperatorNames(state, activePeriodId);
    const raw = currentOperators.map(op => {
      const incomes = state.incomeData.filter(r => r.operator === op && r.periodId === activePeriodId);
      const ops = operatorPayrollOperations(state.operationsData.filter(o => o.periodId === activePeriodId), op);
      
      const { refunds: opRefunds, gross: totalGross, net: totalNet } = calculateOperatorEarnings(incomes,
        state.operationsData.filter(o => o.operator === op && o.periodId === activePeriodId));
      
      const bns = ops.filter(o => o.type === 'bonus').reduce((sum, o) => sum + o.amount, 0);
      const pnl = ops.filter(o => o.type === 'penalty' || o.type === 'internship').reduce((sum, o) => sum + o.amount, 0);
      const adv = ops.filter(o => o.type === 'advance').reduce((sum, o) => sum + o.amount, 0);
      const pay = ops.filter(o => o.type === 'salary_payment').reduce((sum, o) => sum + o.amount, 0);
      
      const remainder = totalNet + bns - (pnl + adv + pay);
      const isPaid = state.paidStatuses.some(s => s.entityName === op && s.entityType === 'operator' && s.periodId === activePeriodId);
      
      return { 
        op, totalGross, refunds: opRefunds, remainder, isPaid,
        bonuses: bns, penalties: pnl, advances: adv,
        ofG: incomes.reduce((sum, r) => sum + r.onlyFans, 0), ofN: incomes.reduce((sum, r) => sum + r.nettoOF, 0),
        ppG: incomes.reduce((sum, r) => sum + r.paypal, 0), ppN: incomes.reduce((sum, r) => sum + r.nettoPP, 0),
        crG: incomes.reduce((sum, r) => sum + r.crypto, 0), crN: incomes.reduce((sum, r) => sum + r.nettoCrypto, 0)
      };
    });
    const sorted = raw.sort((a, b) => {
      if (a.isPaid !== b.isPaid) return a.isPaid ? 1 : -1;
      return b.remainder - a.remainder;
    });
    const maxGross = Math.max(...sorted.map(r => r.totalGross), 1);
    return sorted.map(r => ({ ...r, percentOfMax: (r.totalGross / maxGross) * 100 }));
}
