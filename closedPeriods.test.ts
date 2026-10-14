import { describe, expect, it } from 'vitest';
import { closedPeriodChanges, PERIOD_RECORDS, reopenPeriod } from './closedPeriods';
import { fixture, income } from './syncTestFixtures';
import { mergeConcurrentStates } from './cloudSync';
import { startNextPeriod } from './accountingPeriods';

function closed() {
  const state = fixture();
  state.incomeData = [income('saved')];
  return startNextPeriod(state, 'period', true);
}
describe('closed month protection', () => {
  it.each(PERIOD_RECORDS)('blocks additions, edits and deletions in %s', key => {
    const old = closed() as any;
    old[key] = [{ ...income('protected'), amount: 50 }];
    for (const change of ['add', 'edit', 'delete', 'move', 'tombstone']) {
      const next = structuredClone(old);
      if (change === 'add') next[key].push({ ...next[key][0], id: 'added' });
      if (change === 'edit') next[key][0].amount = 51;
      if (change === 'delete') next[key] = [];
      if (change === 'move') { next[key][0].periodId = 'month-2026-11'; next[key][0].date = '2026-11-01'; }
      if (change === 'tombstone') next.deletedIds.push('protected');
      expect(closedPeriodChanges(old, next).length, change).toBeGreaterThan(0);
    }
  });
  it('blocks backdating into a closed month even with an open or forged period ID', () => {
    const old = closed();
    for (const date of ['2026-10-12', '12.10.2026', '12-10-2026']) {
      const next = structuredClone(old); next.incomeData.push({ ...income('new'), date, periodId: 'month-2026-11' });
      expect(closedPeriodChanges(old, next)).toHaveLength(1);
    }
  });
  it('allows a separate owner reopen, but not admin reopen or reopen plus edits', () => {
    const old = closed(), next = reopenPeriod(old, 'period');
    expect(closedPeriodChanges(old, next, 'owner')).toEqual([]);
    expect(closedPeriodChanges(old, next, 'admin').length).toBeGreaterThan(0);
    next.incomeData = [{ ...next.incomeData[0], total: 999 }];
    expect(closedPeriodChanges(old, next).map(item => item.field)).toEqual(['incomeData[saved]', 'accountingPeriods[period]']);
  });
  it('blocks period deletion, status forgery, boundary changes and rate changes', () => {
    const old = closed();
    for (const change of [undefined, {status:'other'}, {startAt:'2026-09-01'}, {modelRates:{of:99,pp:99,cr:99}}]) {
      const next = structuredClone(old);
      if (!change) next.accountingPeriods.shift(); else Object.assign(next.accountingPeriods[0],change);
      expect(closedPeriodChanges(old,next).length).toBeGreaterThan(0);
    }
  });
  it('permits open-month activity, task updates, reading and array reorder', () => {
    const old = closed(); old.incomeData.push(income('second'));
    const next = structuredClone(old); next.incomeData.reverse();
    next.incomeData.push({...income('november'),periodId:'month-2026-11',date:'2026-11-02'});
    next.ownerDocument = 'Progress'; next.selectedPeriodId = 'period'; next.models = [...next.models, 'New model'];
    expect(closedPeriodChanges(old,next)).toEqual([]);
  });
  it('freezes inherited settings when closing, and protects legacy inherited settings', () => {
    const old = closed(); expect(old.accountingPeriods[0].modelRates).toEqual(old.modelRates);
    delete old.accountingPeriods[0].modelRates;
    const next = structuredClone(old); next.modelRates.of = 99;
    expect(closedPeriodChanges(old,next).map(item=>item.field)).toContain('modelRates');
  });
  it('cannot bypass protection with duplicated IDs', () => {
    const old = closed(), next = structuredClone(old); next.incomeData.push({...income('saved'),total:999});
    expect(closedPeriodChanges(old,next).length).toBeGreaterThan(0);
  });
  it('permits copied roster templates in an open month even when the source date is closed',()=>{
    const old=closed(), next=structuredClone(old);
    next.rosterData=[{id:'template',periodId:'month-2026-11',date:'2026-10-01',shift:'night',operator:'Admin',models:['Model'],createdAt:'2026-10-01'}];
    expect(closedPeriodChanges(old,next)).toEqual([]);
  });
  it('quarantines late offline edits after a concurrent closure, retaining unrelated open-month work', () => {
    const base = fixture(); base.incomeData = [income('saved')];
    const remote = closed(), local = structuredClone(base);
    local.incomeData[0].total = 999;
    local.ownerDocument = 'Unrelated edit';
    const pending = mergeConcurrentStates(local, remote, base);
    expect(pending.conflicts).toContain('incomeData[saved]');
    const recovered = mergeConcurrentStates(local, remote, base, true);
    expect(recovered.state.incomeData[0].total).toBe(100);
    expect(recovered.recovery.find(item=>item.field==='incomeData[saved]')?.local.total).toBe(999);
    expect(recovered.state.ownerDocument).toBe('Unrelated edit');
    expect(closedPeriodChanges(remote,recovered.state)).toEqual([]);
  });
  it('preserves deferred deletions and does not resurrect their tombstones on the next merge', () => {
    const base = fixture(); base.incomeData = [income('saved')];
    const local = structuredClone(base); local.incomeData = []; local.deletedIds = ['saved'];
    const remote = closed(), result = mergeConcurrentStates(local,remote,base,true);
    expect(result.state.incomeData).toEqual(remote.incomeData); expect(result.state.deletedIds).not.toContain('saved');
    expect(result.recovery[0].local).toBeUndefined();
    expect(mergeConcurrentStates(result.state,remote,remote,true).recovery).toEqual([]);
  });
});
