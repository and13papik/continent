import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasSharedChanges, mergeConcurrentStates, syncToCloud } from './cloudSync';
import type { AppState } from './types';

import { fixture, income, fakeDatabase } from './syncTestFixtures';

afterEach(() => vi.unstubAllGlobals());

describe('conditional cloud saves', () => {
  it('preserves additions from two admins and two owners despite simultaneous reads and identical timestamps', async () => {
    const base = fixture(), db = fakeDatabase(base, 4, true);
    vi.stubGlobal('fetch', db.fetch);
    const clients = ['admin-1', 'admin-2', 'owner-1', 'owner-2'].map(id => ({ ...structuredClone(base), incomeData: [income(id)] }));
    const results = await Promise.all(clients.map(client => syncToCloud(client, { baseState: base })));
    expect(results.every(result => result.success)).toBe(true);
    expect(db.current().incomeData.map(row => row.id).sort()).toEqual(['admin-1', 'admin-2', 'owner-1', 'owner-2']);
    expect(db.requests.filter(request => request.method === 'PATCH').length).toBeGreaterThan(4);
    expect(db.requests.every(request => ['GET', 'PATCH'].includes(request.method))).toBe(true);
  });

  it.each([401, 403, 404, 500, 503])('does not write after a failed read (%i)', async status => {
    const mock = vi.fn(async () => new Response('', { status }));
    vi.stubGlobal('fetch', mock);
    expect(await syncToCloud({ ...fixture(), incomeData: [income('new')] })).toMatchObject({ success: false, reason: 'read' });
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it.each(['[]', '[{"state":null,"updated_at":null}]', '[{"state":{},"updated_at":null}]', 'not-json'])('does not recreate or overwrite missing or malformed main: %s', async response => {
    const mock = vi.fn(async () => new Response(response, { status: 200 }));
    vi.stubGlobal('fetch', mock);
    expect((await syncToCloud(fixture())).success).toBe(false);
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it('stops when two users edit the same amount differently', async () => {
    const base = { ...fixture(), incomeData: [income('same')] }, db = fakeDatabase(base, 2);
    vi.stubGlobal('fetch', db.fetch);
    const clients = [150, 200].map(total => ({ ...structuredClone(base), incomeData: [{ ...income('same'), total, onlyFans: total, nettoOF: total * .2 }] }));
    const results = await Promise.all(clients.map(client => syncToCloud(client, { baseState: base })));
    expect(results.filter(result => result.success)).toHaveLength(1);
    expect(results.find(result => !result.success)?.reason).toBe('conflict');
    expect([150, 200]).toContain(db.current().incomeData[0].total);
  });

  it('returns confirmed cloud data rather than claiming success on an empty PATCH', async () => {
    const base = fixture();
    const mock = vi.fn(async (_input: any, options: any = {}) => new Response(options.method === 'PATCH' ? '[]' : JSON.stringify([{ state: base, updated_at: null }]), { status: 200 }));
    vi.stubGlobal('fetch', mock);
    expect(await syncToCloud({ ...base, incomeData: [income('new')] }, { baseState: base })).toMatchObject({ success: false, reason: 'busy' });
    expect(mock).toHaveBeenCalledTimes(16);
  });

  it('rejects an unconfirmed write response', async () => {
    const base = fixture();
    vi.stubGlobal('fetch', vi.fn(async (_input: any, options: any = {}) => new Response(JSON.stringify([{ state: base, updated_at: null }]), { status: 200 })));
    expect(await syncToCloud({ ...base, incomeData: [income('new')] }, { baseState: base })).toMatchObject({ success: false, reason: 'write' });
  });

  it('does not write a clean state or broadcast the selected period', async () => {
    const base = fixture(), db = fakeDatabase(base);
    vi.stubGlobal('fetch', db.fetch);
    const local = { ...structuredClone(base), version: 99, selectedPeriodId: 'different', lastUpdated: 999 };
    expect((await syncToCloud(local, { baseState: base })).success).toBe(true);
    expect(db.requests).toHaveLength(1);
  });

  it('keeps both local and cloud inputs immutable', async () => {
    const base = fixture(), local = { ...structuredClone(base), incomeData: [income('new')] }, db = fakeDatabase(base);
    const before = JSON.stringify({ base, local });
    vi.stubGlobal('fetch', db.fetch);
    await syncToCloud(local, { baseState: base });
    expect(JSON.stringify({ base, local })).toBe(before);
  });
});

describe('merging independent edits against each browser baseline', () => {
  it('combines edits to different settings even with inaccurate client clocks', () => {
    const base = fixture(), local = structuredClone(base), remote = structuredClone(base);
    local.modelRates.of = 30; local.lastUpdated = -100;
    remote.modelRates.pp = 22; remote.lastUpdated = 9999999999999;
    const result = mergeConcurrentStates(local, remote, base);
    expect(result.conflicts).toEqual([]);
    expect(result.state.modelRates).toEqual({ of: 30, pp: 22, cr: 25 });
  });

  it('preserves remote edits that did not change record timestamps', () => {
    const base = { ...fixture(), incomeData: [income('existing')] }, local = structuredClone(base), remote = structuredClone(base);
    local.ownerExpenses = [{ id: 'expense', periodId: 'period', category: 'infra', platform: 'all', amount: 20, comment: '', date: '2026-10-13', createdAt: '2026-10-13T00:00:00Z' }];
    remote.incomeData[0].total = 150;
    const merged = mergeConcurrentStates(local, remote, base);
    expect(merged.conflicts).toEqual([]);
    expect(merged.state.incomeData[0].total).toBe(150);
    expect(merged.state.ownerExpenses).toHaveLength(1);
  });

  it('combines edits to different fields of one task', () => {
    const base: any = { ...fixture(), ownerTasks: [{ id: 'task', title: 'Original', status: 'idea', updatedAt: 'old' }] };
    const local = structuredClone(base), remote = structuredClone(base);
    local.ownerTasks[0].title = 'New title'; remote.ownerTasks[0].status = 'completed';
    expect(mergeConcurrentStates(local, remote, base).state.ownerTasks?.[0]).toMatchObject({ title: 'New title', status: 'completed' });
  });

  it('does not silently choose between a deletion and a concurrent edit', () => {
    const base = { ...fixture(), incomeData: [income('record')] }, local = structuredClone(base), remote = structuredClone(base);
    local.deletedIds.push('record'); local.incomeData = [];
    remote.incomeData[0].total = 150;
    expect(mergeConcurrentStates(local, remote, base).conflicts).toContain('incomeData[record]');
  });

  it('does not resurrect a remotely deleted record', () => {
    const base = { ...fixture(), incomeData: [income('record')] }, remote = structuredClone(base);
    remote.deletedIds.push('record'); remote.incomeData = [];
    expect(mergeConcurrentStates(base, remote, base).state.incomeData).toEqual([]);
  });

  it('handles tombstones even if a stale row remains in its source array', () => {
    const base = { ...fixture(), incomeData: [income('record')] }, local = structuredClone(base), remote = structuredClone(base);
    remote.deletedIds.push('record'); local.incomeData[0].total = 150;
    expect(mergeConcurrentStates(local, remote, base).conflicts).toContain('incomeData[record]');
  });

  it('preserves added and removed names independently', () => {
    const base = { ...fixture(), operators: ['A', 'B'] }, local = { ...base, operators: ['B'] }, remote = { ...base, operators: ['A', 'B', 'C'] };
    expect(mergeConcurrentStates(local, remote, base).state.operators).toEqual(['B', 'C']);
  });

  it('preserves unknown saved fields including cryptoWallets', () => {
    const base: any = { ...fixture(), cryptoWallets: [{ id: 'wallet', address: 'old' }] }, local = structuredClone(base), remote = structuredClone(base);
    remote.cryptoWallets[0].address = 'new';
    expect((mergeConcurrentStates(local, remote, base).state as any).cryptoWallets[0].address).toBe('new');
  });

  it('reports a conflict for different scalar values without a trusted baseline', () => {
    const base = fixture(), local = { ...base, ownerDocument: 'Local' }, remote = { ...base, ownerDocument: 'Remote' };
    expect(mergeConcurrentStates(local, remote).conflicts).toContain('ownerDocument');
  });

  it('retains local connection and selected period without marking them as a shared edit', () => {
    const base = fixture(); base.accountingPeriods.push({ ...base.accountingPeriods[0], id: 'other' });
    const local = { ...base, selectedPeriodId: 'other', syncKey: 'local-key' }, remote = { ...base, syncKey: 'remote-key' };
    const result = mergeConcurrentStates(local, remote, base);
    expect(result.state.syncKey).toBe('local-key');
    expect(result.state.selectedPeriodId).toBe('other');
    expect(hasSharedChanges(local, base)).toBe(false);
  });

  it('does not deduplicate or move financial records between periods while syncing', () => {
    const base = fixture(); base.accountingPeriods.push({ ...base.accountingPeriods[0], id: 'duplicate-calendar' });
    base.ownerExpenses = [{ id: 'expense', periodId: 'duplicate-calendar', category: 'infra', platform: 'all', amount: 20, comment: '', date: '2026-10-13', createdAt: '2026-10-13T00:00:00Z' }];
    expect(mergeConcurrentStates(base, base, base).state.ownerExpenses[0].periodId).toBe('duplicate-calendar');
    expect(mergeConcurrentStates(base, base, base).state.accountingPeriods).toHaveLength(2);
  });

  it('does not repeatedly save an identical deletion set in a different order', () => {
    const a = { ...fixture(), deletedIds: ['a', 'b'] }, b = { ...fixture(), deletedIds: ['b', 'a'] };
    expect(hasSharedChanges(a, b)).toBe(false);
  });

  it.each([undefined, 'saved-revision'])('does not accept a legacy writer removing a saved record while reusing revision %s', revision => {
    const base = { ...fixture(), syncRevision: 'saved-revision', incomeData: [income('saved')] };
    const legacy = { ...fixture(), syncRevision: revision };
    const merged = mergeConcurrentStates(base, legacy, base);
    expect(merged.conflicts).toContain('syncRevision');
    expect(merged.state.incomeData[0].id).toBe('saved');
  });
});
