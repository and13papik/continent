import { describe, expect, it } from 'vitest';
import { calculateModelEarnings, calculateOperatorEarnings, calculateOwnerFinancials, periodModelNames, periodOperatorNames, operatorPayrollOperations } from './financialCalculations';
import { fixture, income } from './syncTestFixtures';
import type { OperationRecord } from './types';

const operation = (overrides: Partial<OperationRecord> = {}): OperationRecord => ({ id: 'operation', periodId: 'period', type: 'refund', operator: 'Admin', model: 'Model', amount: 100, date: '2026-10-01', createdAt: '2026-10-01T00:00:00Z', comment: '', ...overrides });
const mixedIncome = () => ({ ...income('mixed'), onlyFans: 100, paypal: 100, total: 200, nettoOF: 20, nettoPP: 20 });

describe('model refunds and owner profit', () => {
  it('deducts a platform refund at that platform rate on both model and owner screens', () => {
    const state = fixture(); state.incomeData = [mixedIncome()];
    state.operationsData = [operation({ platform: 'paypal' })];
    const model = calculateModelEarnings(state.incomeData, state.operationsData, state.modelRates, 0);
    expect(model.accruedSalary).toBe(25);
    expect(calculateOwnerFinancials(state, 'period').modelAccrued).toBe(25);
  });
  it('uses the exact gross denominator for an unallocated refund, with no extra dollar', () => {
    const state = fixture(); state.incomeData = [income('one')]; state.operationsData = [operation()];
    expect(calculateOwnerFinancials(state, 'period').modelAccrued).toBe(0);
  });
  it('keeps a generic refund rate independent of previously applied platform refunds', () => {
    const rows = [mixedIncome()];
    const result = calculateModelEarnings(rows, [operation({ amount: 50, platform: 'paypal' }), operation({ id: 'generic', amount: 50 })], fixture().modelRates, 0);
    // 25 + 17, minus 50*17%, minus 50*21% = 23.
    expect(result.accruedSalary).toBe(23);
  });
  it('preserves the existing zero floor for platform-specific model commissions', () => {
    expect(calculateModelEarnings([income('one')], [operation({amount: 200,platform: 'onlyFans'})], fixture().modelRates, 0).earnOF).toBe(0);
  });
  it('includes historical model earnings even after the current roster changes', () => {
    const state = fixture(); state.models = ['New Model']; state.incomeData = [income('old')];
    expect(periodModelNames(state, 'period')).toContain('Model');
    expect(calculateOwnerFinancials(state, 'period').modelAccrued).toBe(25);
  });
  it('includes manual-only periods and keeps owner advances separate from profit', () => {
    const state = fixture(); state.ownerManualIncomes = [{id:'manual', periodId:'period',amount:100,platform:'all',comment:'',date:'2026-10-01',createdAt:'2026-10-01'}];
    state.ownerAdvances = [{id:'advance',periodId:'period',ownerName:'Andrey',amount:20,platform:'crypto',comment:'',date:'2026-10-01',createdAt:'2026-10-01'}];
    const result = calculateOwnerFinancials(state,'period');
    expect(result.netProfitTotal).toBe(100); expect(result.andrey.totalShare-result.andrey.advances).toBe(30);
  });
});

describe('staff and period boundaries', () => {
  it('uses each operator rate so an agency average cannot alter a refund deduction', () => {
    const first = income('first'), second = { ...income('second'), operator:'Other', nettoOF:40 };
    const state = fixture(); state.incomeData=[first,second]; state.operationsData=[operation({amount:50})];
    const a = calculateOperatorEarnings([first],state.operationsData), b=calculateOperatorEarnings([second],[]);
    expect(a.net+b.net).toBe(50); expect(calculateOwnerFinancials(state,'period').staffAccrued).toBe(50);
    expect(periodOperatorNames(state,'period')).toContain('Other');
  });
  it('excludes system/model/admin adjustments from staff salaries in any month', () => {
    const state=fixture(); state.incomeData=[income('one')]; state.admins=[{id:'boss',name:'Boss',rate:8}];
    state.operationsData=[operation({type:'bonus',operator:'SYSTEM',amount:250}),operation({id:'admin',type:'penalty',operator:'Boss',model:undefined,amount:15}),operation({id:'model',operator:'Model',type:'bonus',amount:75})];
    const result=calculateOwnerFinancials(state,'period');
    expect(result.staffAccrued).toBe(20); expect(result.adminAccrued).toBe(8);
  });
  it('treats advances and salary payments as payments, without deducting them twice from profit', () => {
    const state=fixture(); state.incomeData=[income('one')];
    state.operationsData=[operation({type:'advance',model:undefined,amount:5}),operation({id:'salary',type:'salary_payment',model:undefined,amount:10})];
    const result=calculateOwnerFinancials(state,'period');
    expect(result.staffAccrued).toBe(20);expect(result.staffPaid).toBe(15);expect(result.staffRemainder).toBe(5);expect(result.netProfitTotal).toBe(55);
  });
  it('uses archived period rates and keeps all stored records and amounts immutable', () => {
    const state=fixture();state.incomeData=[income('one')];state.accountingPeriods[0].modelRates={of:30,pp:20,cr:30};
    state.operationsData=[operation({periodId:'another',amount:999})];const before=JSON.stringify(state);
    expect(calculateOwnerFinancials(state,'period').modelAccrued).toBe(30);
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe('operator adjustments with an account selected', () => {
  it.each(['open', 'closed'] as const)('counts bonuses and deductions in a %s period without rewriting records or payment markers', status => {
    const state = fixture(); state.incomeData = [income('one')];
    state.accountingPeriods[0].status = status;
    state.operationsData = [
      operation({id:'bonus',type:'bonus',amount:50}),
      operation({id:'penalty',type:'penalty',amount:15}),
      operation({id:'training',type:'internship',amount:5}),
      operation({id:'advance',type:'advance',model:undefined,amount:10}),
      operation({id:'model-payment',operator:'SYSTEM',type:'advance',amount:7}),
      operation({id:'other',operator:'Other',type:'bonus',amount:9}),
    ];
    const before = structuredClone(state);
    const selected = operatorPayrollOperations(state.operationsData,'Admin');
    expect(selected.map(row=>row.id)).toEqual(['bonus','penalty','training','advance']);
    const totals = calculateOwnerFinancials(state,'period');
    expect(totals.staffAccrued).toBe(59); // 20 + 50 - 15 - 5, plus Other's 9.
    expect(totals.staffPaid).toBe(10);
    expect(totals.staffRemainder).toBe(49);
    expect(totals.modelAccrued).toBe(25);
    expect(totals.modelPaid).toBe(7);
    expect(state).toEqual(before);
  });
  it('deducts an account-specific refund once and keeps payment routing unchanged', () => {
    const rows = [operation({amount:50}),operation({id:'bonus',type:'bonus',amount:5}),
      operation({id:'model-advance',type:'advance',amount:550}),
      operation({id:'system',operator:'SYSTEM',type:'bonus',amount:1000})];
    const ops = operatorPayrollOperations(rows,'Admin');
    expect(ops.map(row=>row.id)).toEqual(['operation','bonus']);
    expect(calculateOperatorEarnings([income('one')],ops).net).toBe(10);
    expect(operatorPayrollOperations(rows,'SYSTEM')).toEqual([]);
    expect(operatorPayrollOperations(rows,'')).toEqual([]);
  });
  it('preserves two legitimate model advances with equal amounts and a completed payment', () => {
    const state=fixture(); state.incomeData=[{...income('one'),onlyFans:8000,total:8000,nettoOF:1600}];
    state.operationsData=[operation({id:'first',type:'advance',operator:'SYSTEM',amount:550}),
      operation({id:'second',type:'advance',operator:'SYSTEM',amount:550}),
      operation({id:'salary',type:'salary_payment',operator:'SYSTEM',amount:900})];
    state.paidStatuses=[{id:'paid',entityType:'model',entityName:'Model',periodId:'period',createdAt:'2026-10-01'}];
    const before=structuredClone(state),totals=calculateOwnerFinancials(state,'period');
    expect(totals.modelAccrued).toBe(2000); expect(totals.modelPaid).toBe(2000); expect(totals.modelRemainder).toBe(0);
    expect(totals.staffPaid).toBe(0); expect(state).toEqual(before);
  });
  it('does not reopen a paid operator or change the amount of an existing payout', () => {
    const state=fixture(); state.incomeData=[income('one')];
    state.operationsData=[operation({id:'bonus',type:'bonus',amount:50}),operation({id:'salary',type:'salary_payment',model:undefined,amount:70})];
    state.paidStatuses=[{id:'paid',entityType:'operator',entityName:'Admin',periodId:'period',createdAt:'2026-10-01'}];
    const totals=calculateOwnerFinancials(state,'period');
    expect(totals.staffAccrued).toBe(70); expect(totals.staffPaid).toBe(70); expect(totals.staffRemainder).toBe(0);
    expect(state.operationsData[1].amount).toBe(70); expect(state.paidStatuses).toHaveLength(1);
  });
});
