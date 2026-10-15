import { describe, expect, it } from 'vitest';
import { fixture, income } from './syncTestFixtures';
import { operatorPayrollRows } from './operatorPayroll';
import { dashboardSummary } from './dashboardSummary';
import { calculateOwnerFinancials } from './financialCalculations';
import type { OperationRecord } from './types';

const op = (id: string, type: OperationRecord['type'], amount: number, extra = {}): OperationRecord => ({ id, type, amount, operator: 'Admin', periodId: 'period', date: '2026-10-13', createdAt: '2026-10-13', comment: '', ...extra });

describe('separate operator payroll screen', () => {
  it('keeps platform commissions, account-linked adjustments and refunds in the moved ledger', () => {
    const state = fixture(); state.incomeData = [income('one')];
    state.operationsData = [op('b', 'bonus', 10, { model: 'Model' }), op('p', 'penalty', 5, { model: 'Model' }), op('r', 'refund', 20, { model: 'Model' }), op('a', 'advance', 3), op('s', 'salary_payment', 2)];
    const before = structuredClone(state), [row] = operatorPayrollRows(state, 'period'), summary = dashboardSummary(state, 'period');
    expect(row).toMatchObject({ op: 'Admin', totalGross: 80, refunds: 20, bonuses: 10, penalties: 5, advances: 3, ofG: 100, ofN: 20, remainder: 16, isPaid: false });
    expect(summary.netEarned + summary.bonuses - summary.penalties).toBe(21);
    expect(summary.paidOut).toBe(5);
    expect(summary.totalGross).toBe(80);
    expect(state).toEqual(before);
  });
  it('preserves paid markers, period isolation and positive-only outstanding totals', () => {
    const state = fixture(); state.incomeData = [income('a'), { ...income('b'), operator: 'Other' }];
    state.operationsData = [op('a', 'advance', 50), op('unrelated', 'bonus', 999, { periodId: 'old' })];
    state.paidStatuses = [{id:'paid', periodId:'period', entityType:'operator', entityName:'Other', createdAt:'2026-10-13'}];
    const rows = operatorPayrollRows(state, 'period');
    expect(rows.map(r => r.op)).toEqual(['Admin', 'Other']);
    expect(rows[0].remainder).toBe(-30);
    expect(rows.reduce((s, r) => s + (r.isPaid ? 0 : Math.max(0, r.remainder)), 0)).toBe(0);
  });
  it('matches Owners staff accrual and payments without deducting payments from profit twice', () => {
    const state = fixture(); state.incomeData = [income('a')];
    const before = calculateOwnerFinancials(state, 'period');
    state.operationsData = [op('a', 'advance', 6), op('s', 'salary_payment', 14)];
    const summary = dashboardSummary(state, 'period'), owners = calculateOwnerFinancials(state, 'period');
    expect(summary.netEarned + summary.bonuses - summary.penalties).toBe(owners.staffAccrued);
    expect(summary.paidOut).toBe(owners.staffPaid);
    expect(owners.netProfitTotal).toBe(before.netProfitTotal);
    expect(operatorPayrollRows(state, 'period')[0].remainder).toBe(0);
  });
  it('keeps closed-month computations read-only, with archived operators still visible', () => {
    const state = fixture(); state.incomeData = [income('a')]; state.operators = [];
    state.accountingPeriods[0].status = 'closed'; const before = structuredClone(state);
    expect(operatorPayrollRows(state, 'period')[0].ofN).toBe(20);
    expect(dashboardSummary(state, 'period').totalGross).toBe(100);
    expect(state).toEqual(before);
  });
});
