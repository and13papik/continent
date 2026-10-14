import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCloudState } from './useCloudState';
import { fixture, income, fakeDatabase } from './syncTestFixtures';
import type { AppState } from './types';
import { adminView } from './stateAccess';

const journal = vi.hoisted(() => ({ base: undefined as any, pending: null as boolean | null, notices: [] as any[], archives: [] as any[], failArchive: false, holdArchive: undefined as Promise<void> | undefined }));
vi.mock('./syncStorage', () => ({
  loadSyncBase: vi.fn(async () => journal.base),
  saveSyncBase: vi.fn(async (_url, state) => { journal.base = structuredClone(state); }),
  readPendingSync: vi.fn(() => journal.pending),
  markPendingSync: vi.fn((_url, pending) => { journal.pending = pending; }),
  loadRecoveries: vi.fn(async () => journal.notices),
  archiveRecovery: vi.fn(async (_url, local, remote, base, items) => {
    if (journal.failArchive) throw new Error('Quota full');
    if (journal.holdArchive) await journal.holdArchive;
    const notice = { id: String(journal.archives.length), createdAt: new Date().toISOString(), items };
    journal.archives.push(structuredClone({ ...notice, local, remote, base }));
    journal.notices = [...journal.notices, notice];
    return journal.notices;
  }),
  dismissRecoveryItem: vi.fn(async (_url, id, field) => {
    journal.notices = journal.notices.map(n => n.id === id ? { ...n, items: n.items.filter((i: any) => i.field !== field) } : n).filter(n => n.items.length);
    return journal.notices;
  }),
}));

let hook: ReturnType<typeof useCloudState>;
let renderer: TestRenderer.ReactTestRenderer | undefined;
let storage: Map<string, string>;
let testRole: 'admin' | 'owner' | undefined;
function Harness() { hook = useCloudState(undefined, testRole); return null; }
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
  journal.notices = []; journal.archives = []; journal.failArchive = false; journal.holdArchive = undefined;
  testRole = undefined;
});
afterEach(async () => {
  await act(async () => { renderer?.unmount(); });
  renderer = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('browser sync lifecycle', () => {
  it('upgrades an admin cache without leaking private fields or losing offline income and owner edits', async () => {
    const base = {...fixture(), ownerDocument:'PRIVATE BASE'};
    const local = {...base, ownerDocument:'PRIVATE OFFLINE', incomeData:[income('offline-admin')]};
    storage.set('continental_dashboard_v3',JSON.stringify(local));journal.base=base;journal.pending=true;testRole='admin';
    const db=fakeDatabase(adminView(base));vi.stubGlobal('fetch',db.fetch);
    await mount();await tick(6000);
    expect(hook.state.ownerDocument).toBe('');expect(hook.state.incomeData.map(row=>row.id)).toContain('offline-admin');
    expect(hook.recoveries).toEqual([]);expect(journal.archives.some(archive=>archive.local.ownerDocument==='PRIVATE OFFLINE')).toBe(true);
    expect(db.current().incomeData.map(row=>row.id)).toContain('offline-admin');expect(hook.cloudStatus).toBe('success');
  });
  it('persists an edit before a network save and keeps it pending after failure', async () => {
    const db = fakeDatabase(fixture()); vi.stubGlobal('fetch', db.fetch);
    await mount(); db.failReads(1);
    act(() => { hook.updateState(state => ({ ...state, incomeData: [income('offline')] })); });
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
    act(() => { hook.updateState(state => ({ ...state, incomeData: [income('retry')] })); });
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
    act(() => { hook.updateState(state => ({ ...state, incomeData: [income('first')] })); });
    await tick(3000);
    expect(hook.isSyncing).toBe(true);
    act(() => { hook.updateState(state => ({ ...state, incomeData: [...state.incomeData, income('second')] })); });
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
    act(() => { hook.updateState(state => ({ ...state, incomeData: [income('local')] })); });
    db.replace({ ...structuredClone(base), version: 2, incomeData: [income('remote')] });
    await tick(15000);
    expect(hook.state.incomeData.map(row => row.id).sort()).toEqual(['local', 'remote']);
    expect(journal.pending).toBe(true);
    rejectWrites = false;
    await act(async () => { await hook.refreshCloudStatus(); });
    expect(db.current().incomeData.map(row => row.id).sort()).toEqual(['local', 'remote']);
    expect(hook.state.incomeData).toHaveLength(2);
  });

  it('archives a same-record conflict before showing fresh cloud data without overwriting it', async () => {
    const baseline = { ...fixture(), incomeData: [income('row')] };
    journal.base = baseline; journal.pending = true;
    const local = structuredClone(baseline); local.incomeData[0].total = 150;
    const remote = structuredClone(baseline); remote.incomeData[0].total = 200;
    storage.set('continental_dashboard_v3', JSON.stringify(local));
    const db = fakeDatabase(remote); vi.stubGlobal('fetch', db.fetch);
    await mount(); await tick(3000);
    expect(hook.cloudStatus).toBe('success');
    expect(hook.state.incomeData[0].total).toBe(200);
    expect(journal.archives[0].local.incomeData[0].total).toBe(150);
    expect(hook.recoveries[0].items[0].local.total).toBe(150);
    expect(db.current().incomeData[0].total).toBe(200);
    expect(db.requests.some(request => request.method === 'PATCH')).toBe(false);
  });

  it('conservatively retains conflicting local edits when the persisted baseline is unavailable', async () => {
    journal.base = undefined; journal.pending = true;
    const local = { ...fixture(), ownerDocument: 'Unsent local note' }, remote = { ...fixture(), ownerDocument: 'Other owner note' };
    storage.set('continental_dashboard_v3', JSON.stringify(local));
    const db = fakeDatabase(remote); vi.stubGlobal('fetch', db.fetch);
    await mount(); await tick(3000);
    expect(hook.cloudStatus).toBe('success');
    expect(hook.state.ownerDocument).toBe('Other owner note');
    expect(journal.archives[0].local.ownerDocument).toBe('Unsent local note');
    expect(db.current().ownerDocument).toBe('Other owner note');
  });

  it('leaves all local edits intact when the recovery archive cannot be committed', async () => {
    const base = { ...fixture(), incomeData: [income('row')] };
    journal.base = base; journal.pending = true; journal.failArchive = true;
    const local = structuredClone(base), remote = structuredClone(base);
    local.incomeData[0].total = 150; remote.incomeData[0].total = 200;
    storage.set('continental_dashboard_v3', JSON.stringify(local));
    const db = fakeDatabase(remote); vi.stubGlobal('fetch', db.fetch);
    await mount(); await tick(6000);
    expect(hook.cloudStatus).toBe('conflict');
    expect(hook.state.incomeData[0].total).toBe(150);
    expect(JSON.parse(storage.get('continental_dashboard_v3')!).incomeData[0].total).toBe(150);
    expect(db.requests.some(r => r.method === 'PATCH')).toBe(false);
  });

  it('retains review choices after reload, and only sends a local choice after explicit selection', async () => {
    const base = { ...fixture(), incomeData: [income('row')] };
    journal.base = base; journal.pending = true;
    const local = structuredClone(base), remote = structuredClone(base);
    local.incomeData[0].total = 150; remote.incomeData[0].total = 200;
    storage.set('continental_dashboard_v3', JSON.stringify(local));
    const db = fakeDatabase(remote); vi.stubGlobal('fetch', db.fetch);
    await mount();
    await act(async () => { renderer!.unmount(); }); await mount();
    expect(hook.recoveries).toHaveLength(1);
    const notice = hook.recoveries[0], item = notice.items[0];
    await act(async () => { await hook.resolveRecovery(notice, item, true, remote.incomeData[0]); });
    await tick(3000);
    expect(db.current().incomeData[0].total).toBe(150);
    expect(hook.recoveries).toEqual([]);
    expect(journal.archives[0].local.incomeData[0].total).toBe(150);
  });

  it('polls metadata instead of downloading unchanged financial data', async () => {
    const db = fakeDatabase(fixture()); vi.stubGlobal('fetch', db.fetch);
    await mount(); await tick(16000);
    expect(db.requests.filter(r => r.url.searchParams.get('select') === 'state,updated_at')).toHaveLength(1);
    expect(db.requests.filter(r => r.url.searchParams.get('select') === 'id,updated_at,revision:state->>syncRevision')).toHaveLength(3);
    expect(db.requests.some(r => r.method === 'PATCH')).toBe(false);
  });

  it('pulls a changed cloud snapshot on the next metadata poll', async () => {
    const db = fakeDatabase(fixture()); vi.stubGlobal('fetch', db.fetch);
    await mount();
    db.replace({ ...fixture(), incomeData: [income('fresh')] });
    await tick(5000);
    expect(hook.state.incomeData[0].id).toBe('fresh');
    expect(db.requests.some(r => r.method === 'PATCH')).toBe(false);
  });

  it('notices a new revision even when two saves have the same timestamp', async () => {
    const initial = { ...fixture(), syncRevision: 'first' }, db = fakeDatabase(initial, 0, true);
    journal.base = initial; storage.set('continental_dashboard_v3', JSON.stringify(initial));
    vi.stubGlobal('fetch', db.fetch); await mount();
    db.replace({ ...initial, syncRevision: 'second', incomeData: [income('new-revision')] });
    await tick(5000);
    expect(hook.state.incomeData[0].id).toBe('new-revision');
  });

  it('does not replace an edit made while the safety archive is being written', async () => {
    const base = { ...fixture(), incomeData: [income('row')] };
    journal.base = base; journal.pending = true;
    const local = structuredClone(base), remote = structuredClone(base);
    local.incomeData[0].total = 150; remote.incomeData[0].total = 200;
    storage.set('continental_dashboard_v3', JSON.stringify(local));
    let release!: () => void;
    journal.holdArchive = new Promise<void>(resolve => { release = resolve; });
    vi.stubGlobal('fetch', fakeDatabase(remote).fetch);
    await mount();
    act(() => { hook.updateState(state => ({ ...state, incomeData: [...state.incomeData, income('during-archive')] })); });
    await act(async () => { journal.holdArchive = undefined; release(); });
    expect(hook.state.incomeData.some(row => row.id === 'during-archive')).toBe(true);
    expect(hook.state.incomeData[0].total).toBe(150);
    await tick(5000);
    expect(hook.state.incomeData.some(row => row.id === 'during-archive')).toBe(true);
    expect(hook.state.incomeData[0].total).toBe(200);
  });

  it('does not save when only changing the selected period', async () => {
    const baseline = fixture(); baseline.accountingPeriods.push({ ...baseline.accountingPeriods[0], id: 'second-period' });
    journal.base = baseline;
    storage.set('continental_dashboard_v3', JSON.stringify(baseline));
    const db = fakeDatabase(baseline); vi.stubGlobal('fetch', db.fetch);
    await mount();
    act(() => { hook.updateState(state => ({ ...state, selectedPeriodId: 'second-period' })); });
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
