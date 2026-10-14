import { describe, expect, it } from 'vitest';
import { adminView, adminRecoveryItem, manualIncomeTotal } from './stateAccess';
import { hasSharedChanges, mergeConcurrentStates } from './cloudSync';
import { fixture, income } from './syncTestFixtures';

export const privateFixture = () => ({...fixture(), ownerDocument:'PRIVATE DOCUMENT', completedDocument:'PRIVATE ARCHIVE', ownerNotes:[{id:'note',text:'PRIVATE NOTE'}],
  ownerExpenses:[{id:'expense',amount:300,comment:'PRIVATE EXPENSE'}], ownerAdvances:[{id:'owner-advance',amount:200}],
  ownerManualIncomes:[{id:'manual',periodId:'period',amount:100,comment:'PRIVATE INCOME'}],
  ownerTasks:[{id:'private-task',assignedTo:'Andrey',title:'PRIVATE TASK'},{id:'shared-task',assignedTo:'Admins',title:'SHARED TASK'}],
  futurePrivateField:'PRIVATE FUTURE', syncKey:'PRIVATE KEY', dbUrl:'PRIVATE DB'} as any);

describe('admin view and role changes', () => {
  it('redacts owner records, unknown fields and secrets, retaining required totals and shared tasks', () => {
    const state=privateFixture(), before=JSON.stringify(state), view=adminView(state);
    expect(JSON.stringify(view)).not.toContain('PRIVATE');expect(view.ownerTasks?.map(task=>task.id)).toEqual(['shared-task']);
    expect(manualIncomeTotal(view,'period')).toBe(manualIncomeTotal(state,'period'));expect(view.ownerExpenses).toEqual([]);
    expect(JSON.stringify(state)).toBe(before);
  });
  it('does not treat server-only totals or redaction as edits or same-revision corruption', () => {
    const base={...privateFixture(),syncRevision:'same'}, remote=adminView(base);
    expect(hasSharedChanges(base,remote)).toBe(false);
    const merged=mergeConcurrentStates(base,remote,base,true);
    expect(merged.conflicts).toEqual([]);expect(merged.state.ownerDocument).toBe('');
    expect(hasSharedChanges({...remote,manualIncomeTotals:{period:999}},remote)).toBe(false);
  });
  it('archives unconfirmed private edits and still keeps unrelated admin income edits', () => {
    const base=privateFixture(),local={...base,ownerDocument:'PRIVATE OFFLINE EDIT',incomeData:[income('offline')]};
    const merged=mergeConcurrentStates(local,adminView(base),base,true);
    expect(merged.recovery.find(item=>item.field==='ownerDocument')?.local).toBe('PRIVATE OFFLINE EDIT');
    expect(merged.state.ownerDocument).toBe('');expect(merged.state.incomeData).toHaveLength(1);
    expect(merged.recovery.filter(adminRecoveryItem)).toEqual([]);
  });
  it('restores owner visibility after an admin session without deleting private data or shared task edits', () => {
    const remote=privateFixture(),base=adminView(remote),local=structuredClone(base);
    local.ownerTasks![0].title='Admin edited task';local.incomeData=[income('offline')];
    const merged=mergeConcurrentStates(local,remote,base,true);
    expect(merged.conflicts).toEqual([]);expect(merged.state.ownerDocument).toBe(remote.ownerDocument);
    expect(merged.state.ownerTasks).toHaveLength(2);expect(merged.state.ownerTasks?.find(task=>task.id==='shared-task')?.title).toBe('Admin edited task');
    expect(merged.state.accessScope).toBeUndefined();expect(merged.state.incomeData).toHaveLength(1);
  });
});
