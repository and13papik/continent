import { describe, expect, it } from 'vitest';
import { fixture, income } from './syncTestFixtures';
import { operatorPayrollRows } from './operatorPayroll';
import { calculateOwnerFinancials } from './financialCalculations';
import { parsePayrollAmount, recordPayrollPayment, type PayrollPayment } from './payrollPayments';

const request = (patch: Partial<PayrollPayment> = {}): PayrollPayment => ({ id: 'payroll-test', periodId: 'period', operator: 'Admin', kind: 'advance', amount: '5,25', date: '2026-10-15', comment: 'Test', ...patch });
const funded = () => { const state = fixture(); state.incomeData = [income('earned')]; return state; };

describe('PAY operator payments', () => {
  it('records an advance and a partial salary once, then settles the remaining balance', () => {
    const original = funded(), baseline = structuredClone(original);
    const advance = recordPayrollPayment(original, request());
    expect(operatorPayrollRows(advance, 'period')[0]).toMatchObject({ accrued: 20, paidOut: 5.25, remainder: 14.75, isPaid: false });
    const partial = recordPayrollPayment(advance, request({ id: 'partial', kind: 'salary_payment', amount: '4.75' }));
    expect(operatorPayrollRows(partial, 'period')[0]).toMatchObject({ advances: 5.25, salaryPayments: 4.75, remainder: 10, isPaid: false });
    expect(recordPayrollPayment(partial, request({ id: 'partial', kind: 'salary_payment', amount: '4.75' }))).toBe(partial);
    expect(() => recordPayrollPayment(partial, request({ id: 'partial', kind: 'salary_payment', amount: '4.00' }))).toThrow('уже используется');
    const settled = recordPayrollPayment(partial, request({ id: 'final', kind: 'salary_payment', amount: '10' }));
    expect(operatorPayrollRows(settled, 'period')[0]).toMatchObject({ paidOut: 20, remainder: 0, isPaid: true });
    expect(settled.operationsData).toHaveLength(3);
    expect(settled.paidStatuses).toHaveLength(1);
    expect(calculateOwnerFinancials(settled, 'period').netProfitTotal).toBe(calculateOwnerFinancials(original, 'period').netProfitTotal);
    expect(original).toEqual(baseline);
  });
  it('settles fractional-cent accruals without leaving a hidden debt', () => {
    const state = funded(); state.incomeData[0].nettoOF = 20.004;
    const next = recordPayrollPayment(state, request({ kind: 'salary_payment', amount: '20.00' }));
    expect(operatorPayrollRows(next, 'period')[0].remainder).toBe(0);
    expect(next.operationsData[0].amount).toBe(20.004);
  });
  it('revalidates the latest balance, period and paid marker', () => {
    const state = recordPayrollPayment(funded(), request({ amount: '15' }));
    expect(() => recordPayrollPayment(state, request({ id: 'stale', amount: '10' }))).toThrow('превышает');
    expect(() => recordPayrollPayment({ ...state, selectedPeriodId: 'another' }, request({ id: 'new' }))).toThrow('Период изменился');
    state.accountingPeriods[0].status = 'closed';
    expect(() => recordPayrollPayment(state, request({ id: 'new' }))).toThrow('закрыт');
    const settled = recordPayrollPayment(funded(), request({ kind: 'salary_payment', amount: '20' }));
    expect(() => recordPayrollPayment(settled, request({ id: 'again' }))).toThrow('уже отмечен');
  });
  it('rejects invalid money, dates, missing operators and deleted request IDs', () => {
    for (const value of ['0', '-1', '1.234', '1e3', 'NaN', 'Infinity', '12abc', '']) expect(() => parsePayrollAmount(value)).toThrow();
    expect(parsePayrollAmount('10,25')).toBe(10.25);
    expect(() => recordPayrollPayment(funded(), request({ date: '2026-02-30' }))).toThrow('дату');
    expect(() => recordPayrollPayment(funded(), request({ operator: 'missing' }))).toThrow('недоступен');
    const state = funded(); state.deletedIds = ['payroll-test'];
    expect(() => recordPayrollPayment(state, request())).toThrow('заново');
  });
  it('reads existing payments without duplicating them and excludes model-directed advances', () => {
    const state = funded();
    state.operationsData = [{ id: 'model-advance', periodId: 'period', operator: 'Admin', model: 'Model', type: 'advance', amount: 100, date: '2026-10-14', createdAt: '2026-10-14', comment: '' }];
    const next = recordPayrollPayment(state, request());
    expect(next.operationsData).toHaveLength(2);
    expect(operatorPayrollRows(next, 'period')[0].advances).toBe(5.25);
  });
});
