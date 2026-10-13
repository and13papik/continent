import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCloudState } from './useCloudState';
import { fixture, income, fakeDatabase } from './syncTestFixtures';
import type { AppState } from './types';

const journal = vi.hoisted(() => ({ base: undefined as any, pending: null as boolean | null }));
vi.mock('./syncStorage', () => ({
  loadSyncBase: vi.fn(async () => journal.base),
  saveSyncBase: vi.fn(async (_url, state) => { journal.base = structuredClone(state); }),
  readPendingSync: vi.fn(() => journal.pending),
  markPendingSync: vi.fn((_url, pending) => { journal.pending = pending; }),
}));

let hook: ReturnType<typeof useCloudState>;
let renderer: TestRenderer.ReactTestRenderer | undefined;
let storage: Map<string, string>;
function Harness() { hook = useCloudState(); return null; }
async function mount() {
  await act(async () => { renderer = TestRenderer.create(<Harness />); });
}
async function tick(ms: number) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}

beforeEach(() => {
  vi.useFakeTimers();
  storage = new Map([['continental_dashboard_v3', JSON.stringify(fixture())]]);
  vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) });
  vi.stubGlobal('window', new EventTarget());
  journal.base = fixture(); journal.pending = false;
});
afterEach(async () => {
  await act(async () => { renderer?.unmount(); });
  renderer = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('browser sync lifecycle', () => {
  it('persists an edit before a network save and keeps it pending after failure', async () => {
    const db = fakeDatabase(fixture()); vi.stubGlobal('fetch', db.fetch);
    await mount(); db.failReads(1);
    act(() => hook.updateState(state => ({ ...state, incomeData: [income('offline')] })));
    expect(JSON.parse(storage.get('continental_dashboard_v3')!).incomeData[0].id).toBe('offline');
    expect(journal.pending).toBe(true);
    await tick(3000);
    expect(hook.cloudStatus).toBe('error');
    expect(hook.state.incomeData[0].id).toBe('offline');
    expect(journal.pending).toBe(true);
    expect(db.current().incomeData).toEqual([]);
  });

  it('retries a failed save without another user edit', async () => {
    const db = fakeDatabase(fixture()); vi.stubGlobal('fetch', db.fetch);
    await mount(); db.failReads(1);
    act(() => hook.updateState(state => ({ ...state, incomeData: [income('retry')] })));
    await tick(3000);
    expect(hook.cloudStatus).toBe('error');
    await tick(6000);
    expect(db.current().incomeData[0].id).toBe('retry');
    expect(hook.cloudStatus).toBe('success');
    expect(journal.pending).toBe(false);
  });

  it('recovers an unsent edit after reload without replacing it with newer cloud data', async () => {
    const baseline = fixture();
    const local = { ...structuredClone(baseline), incomeData: [income('local-offline')] };
    const remote = { ...structuredClone(baseline), version: 50, incomeData: [income('other-admin')] };
    storage.set('continental_dashboard_v3', JSON.stringify(local));
    journal.base = baseline; journal.pending = true;
    const db = fakeDatabase(remote); vi.stubGlobal('fetch', db.fetch);
    await mount();
    expect(hook.state.incomeData.map(row => row.id).sort()).toEqual(['local-offline', 'other-admin']);
    expect(journal.pending).toBe(true);
    await tick(3000);
    expect(db.current().incomeData).toHaveLength(2);
    expect(journal.pending).toBe(false);
  });

  it('keeps edits made while an earlier save is in flight and sends them next', async () => {
    const db = fakeDatabase(fixture());
    let holdPatch: (() => void) | undefined;
    const patchBarrier = new Promise<void>(resolve => { holdPatch = resolve; });
    let firstPatch = true;
    vi.stubGlobal('fetch', vi.fn(async (url, options: any = {}) => {
      if (options.method === 'PATCH' && firstPatch) { firstPatch = false; await patchBarrier; }
      return db.fetch(url, options);
    }));
    await mount();
    act(() => hook.updateState(state => ({ ...state, incomeData: [income('first')] })));
    await tick(3000);
    expect(hook.isSyncing).toBe(true);
    act(() => hook.updateState(state => ({ ...state, incomeData: [...state.incomeData, income('second')] })));
    await act(async () => { holdPatch!(); });
    expect(hook.state.incomeData.map(row => row.id)).toEqual(['first', 'second']);
    expect(journal.pending).toBe(true);
    await tick(3000);
    expect(db.current().incomeData.map(row => row.id)).toEqual(['first', 'second']);
    expect(journal.pending).toBe(false);
  });

  it('does not clear pending changes when a background refresh incorporates another user edit', async () => {
    const base = fixture(), db = fakeDatabase(base);
    let rejectWrites = true;
    vi.stubGlobal('fetch', vi.fn(async (url, options: any = {}) => options.method === 'PATCH' && rejectWrites
      ? new Response('', { status: 503 }) : db.fetch(url, options)));
    await mount();
    act(() => hook.updateState(state => ({ ...state, incomeData: [income('local')] })));
    db.replace({ ...structuredClone(base), version: 2, incomeData: [income('remote')] });
    await tick(15000);
    expect(hook.state.incomeData.map(row => row.id).sort()).toEqual(['local', 'remote']);
    expect(journal.pending).toBe(true);
    rejectWrites = false;
    await act(async () => { await hook.refreshCloudStatus(); });
    expect(db.current().incomeData.map(row => row.id).sort()).toEqual(['local', 'remote']);
    expect(hook.state.incomeData).toHaveLength(2);
  });

  it('retains a same-field conflict locally and does not overwrite the cloud', async () => {
    const baseline = { ...fixture(), incomeData: [income('row')] };
    journal.base = baseline; journal.pending = true;
    const local = structuredClone(baseline); local.incomeData[0].total = 150;
    const remote = structuredClone(baseline); remote.incomeData[0].total = 200;
    storage.set('continental_dashboard_v3', JSON.stringify(local));
    const db = fakeDatabase(remote); vi.stubGlobal('fetch', db.fetch);
    await mount(); await tick(3000);
    expect(hook.cloudStatus).toBe('conflict');
    expect(hook.state.incomeData[0].total).toBe(150);
    expect(db.current().incomeData[0].total).toBe(200);
    expect(db.requests.some(request => request.method === 'PATCH')).toBe(false);
  });

  it('conservatively retains conflicting local edits when the persisted baseline is unavailable', async () => {
    journal.base = undefined; journal.pending = true;
    const local = { ...fixture(), ownerDocument: 'Unsent local note' }, remote = { ...fixture(), ownerDocument: 'Other owner note' };
    storage.set('continental_dashboard_v3', JSON.stringify(local));
    const db = fakeDatabase(remote); vi.stubGlobal('fetch', db.fetch);
    await mount(); await tick(3000);
    expect(hook.cloudStatus).toBe('conflict');
    expect(hook.state.ownerDocument).toBe('Unsent local note');
    expect(db.current().ownerDocument).toBe('Other owner note');
  });

  it('does not save when only changing the selected period', async () => {
    const baseline = fixture(); baseline.accountingPeriods.push({ ...baseline.accountingPeriods[0], id: 'second-period' });
    journal.base = baseline;
    storage.set('continental_dashboard_v3', JSON.stringify(baseline));
    const db = fakeDatabase(baseline); vi.stubGlobal('fetch', db.fetch);
    await mount();
    act(() => hook.updateState(state => ({ ...state, selectedPeriodId: 'second-period' })));
    await tick(4000);
    expect(hook.state.selectedPeriodId).toBe('second-period');
    expect(db.requests.filter(request => request.method === 'PATCH')).toHaveLength(0);
  });

  it('ignores requests completing after unmount', async () => {
    let releaseRead: (() => void) | undefined;
    const barrier = new Promise<void>(resolve => { releaseRead = resolve; });
    const db = fakeDatabase(fixture());
    vi.stubGlobal('fetch', vi.fn(async (url, options) => { await barrier; return db.fetch(url, options); }));
    await mount();
    await act(async () => { renderer!.unmount(); renderer = undefined; releaseRead!(); });
    expect(db.requests.filter(request => request.method === 'PATCH')).toHaveLength(0);
  });
});
