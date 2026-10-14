import { afterEach, describe, expect, it, vi } from 'vitest';
import { monthKey, periodValidationError, startNextPeriod } from './accountingPeriods';
import { mergeConcurrentStates, syncToCloud } from './cloudSync';
import { fixture, income, fakeDatabase } from './syncTestFixtures';

afterEach(() => vi.unstubAllGlobals());
describe('safe month creation', () => {
  it('reuses an existing month, including a repeated click with the old source ID', () => {
    const state = fixture(); state.incomeData = [income('keep')];
    const once = startNextPeriod(state, 'period');
    const twice = startNextPeriod(once, 'period');
    expect(twice.accountingPeriods).toHaveLength(2); expect(twice.selectedPeriodId).toBe(once.selectedPeriodId);
    expect(twice.incomeData).toEqual(state.incomeData); expect(monthKey(twice.accountingPeriods[1])).toBe('2026-11');
  });
  it('handles December and a previously deleted deterministic ID', () => {
    const state = fixture(); state.accountingPeriods[0].startAt = '2026-12-01T00:00:00Z'; state.deletedIds=['month-2027-01'];
    const result = startNextPeriod(state,'period',true);
    expect(result.selectedPeriodId).toBe('month-2027-01:2'); expect(result.accountingPeriods[0].status).toBe('closed');
    expect(result.accountingPeriods[1].startAt).toBe('2027-01-01T00:00:00.000Z');
  });
  it('merges simultaneous closing without review or duplicated periods/rosters', async () => {
    const base=fixture(); base.incomeData=[income('keep')];
    base.rosterData=[{id:'roster',periodId:'period',date:'2026-10-01',operator:'Admin'} as any];
    const first=startNextPeriod(base,'period',true,'2026-10-14T01:00:00Z');
    const second=startNextPeriod(base,'period',true,'2026-10-14T01:00:01Z');
    const merged=mergeConcurrentStates(second,first,base,true);
    expect(merged.conflicts).toEqual([]);expect(merged.state.rosterData).toHaveLength(2);
    const db=fakeDatabase(base,2);vi.stubGlobal('fetch',db.fetch);
    const results=await Promise.all([syncToCloud(first,{baseState:base}),syncToCloud(second,{baseState:base})]);
    expect(results.every(result=>result.success)).toBe(true); expect(db.current().accountingPeriods).toHaveLength(2);
    expect(db.current().rosterData).toHaveLength(2);expect(db.current().incomeData).toEqual(base.incomeData);
  });
  it('rejects duplicates by calendar month, label and ID, while retaining existing legacy pairs', () => {
    const before=fixture().accountingPeriods, duplicate={...before[0],id:'another',label:'Renamed'};
    expect(periodValidationError(before,[...before,duplicate])).toBeTruthy();
    expect(periodValidationError(before,[...before,{...duplicate,startAt:'2026-11-01',label:' october '}])).toBeTruthy();
    expect(periodValidationError(before,[before[0],before[0]])).toBeTruthy();
    expect(periodValidationError([...before,duplicate],[...before,duplicate])).toBeNull();
    expect(periodValidationError(before,[...before,{...duplicate,startAt:'invalid'}])).toBeTruthy();
  });
});
