import { describe, expect, it } from 'vitest';
import { mergeConcurrentStates } from './cloudSync';
import { applyRecoveryChoice, recoveryValue } from './syncRecovery';
import { fixture, income } from './syncTestFixtures';

describe('non-blocking conflict recovery', () => {
  it('quarantines a whole disputed financial record while merging independent additions', () => {
    const base = { ...fixture(), incomeData: [income('same')] };
    const local = structuredClone(base), remote = structuredClone(base);
    local.incomeData[0].total = 150; local.incomeData[0].onlyFans = 150;
    remote.incomeData[0].total = 200;
    local.operationsData = [{ id: 'independent', amount: 10 } as any];
    remote.incomeData.push(income('other-admin'));
    const result = mergeConcurrentStates(local, remote, base, true);
    expect(result.state.incomeData).toEqual(remote.incomeData);
    expect(result.state.operationsData).toEqual(local.operationsData);
    expect(result.recovery).toHaveLength(1);
    expect(result.recovery[0].local).toEqual(local.incomeData[0]);
  });
  it('defers a local deletion without leaving a tombstone that hides the cloud record', () => {
    const base = { ...fixture(), incomeData: [income('same')] };
    const local = { ...structuredClone(base), incomeData: [], deletedIds: ['same'] };
    const remote = structuredClone(base); remote.incomeData[0].total = 200;
    const result = mergeConcurrentStates(local, remote, base, true);
    expect(result.state.incomeData).toEqual(remote.incomeData);
    expect(result.state.deletedIds).toEqual([]);
    expect(result.recovery[0].local).toBeUndefined();
    const chosen = applyRecoveryChoice(result.state, result.recovery[0], remote.incomeData[0]);
    expect(chosen.incomeData).toEqual([]);
    expect(chosen.deletedIds).toEqual(['same']);
  });
  it('keeps a remote deletion pending review of an unsent local edit, then explicitly restores it', () => {
    const base = { ...fixture(), incomeData: [income('same')] };
    const local = structuredClone(base); local.incomeData[0].total = 150;
    const remote = { ...structuredClone(base), incomeData: [], deletedIds: ['same'] };
    const result = mergeConcurrentStates(local, remote, base, true);
    expect(result.state.incomeData).toEqual([]);
    const chosen = applyRecoveryChoice(result.state, result.recovery[0], undefined);
    expect(chosen.incomeData[0].total).toBe(150);
    expect(chosen.deletedIds).toEqual([]);
  });
  it('does not resurrect stale local-only rows without a baseline', () => {
    const local = { ...fixture(), incomeData: [income('uncertain')] }, remote = fixture();
    const result = mergeConcurrentStates(local, remote, undefined, true);
    expect(result.state.incomeData).toEqual([]);
    expect(result.recovery[0].local.id).toBe('uncertain');
  });
  it('does not use a broken revision as a trusted baseline', () => {
    const local = { ...fixture(), syncRevision: 'same', incomeData: [income('uncertain')] };
    const remote = { ...fixture(), syncRevision: 'same' };
    const result = mergeConcurrentStates(local, remote, local, true);
    expect(result.state.incomeData).toEqual([]);
    expect(result.recovery[0].local.id).toBe('uncertain');
  });
  it('refuses a reviewed value if the displayed record has changed meanwhile', () => {
    const base = { ...fixture(), incomeData: [income('same')] };
    const local = structuredClone(base), remote = structuredClone(base);
    local.incomeData[0].total = 150; remote.incomeData[0].total = 200;
    const result = mergeConcurrentStates(local, remote, base, true), item = result.recovery[0];
    const expected = recoveryValue(result.state, item);
    const changed = structuredClone(result.state); changed.incomeData[0].total = 300;
    expect(() => applyRecoveryChoice(changed, item, expected)).toThrow('обновилась');
    expect(changed.incomeData[0].total).toBe(300);
  });
});
