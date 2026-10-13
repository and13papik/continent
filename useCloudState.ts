import { useCallback, useEffect, useRef, useState } from 'react';
import { createInitialState, saveLocal } from './store';
import { hasSharedChanges, mergeConcurrentStates, preserveLocalFields, readCloudSnapshot, syncToCloud } from './cloudSync';
import { loadSyncBase, markPendingSync, readPendingSync, saveSyncBase } from './syncStorage';
import type { AppState } from './types';

type CloudStatus = 'idle' | 'loading' | 'success' | 'error' | 'conflict';

export function useCloudState(connection?: Pick<AppState, 'syncUrl' | 'syncKey'>) {
  const [state, setState] = useState<AppState>(() => {
    const initial = createInitialState();
    return connection ? { ...initial, ...connection, dbUrl: undefined } : initial;
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const current = useRef(state);
  const base = useRef<AppState>();
  const pending = useRef(false);
  const editRevision = useRef(0);
  const editedAt = useRef(0);
  const retryAt = useRef(0);
  const refresh = useRef<() => Promise<void>>(async () => {});

  const apply = useCallback((next: AppState) => {
    current.current = next;
    try { saveLocal(next); } catch { setCloudStatus('error'); }
    setState(next);
  }, []);

  const updateState = useCallback((updater: (previous: AppState) => AppState) => {
    const previous = current.current;
    const updated = updater(previous);
    const changed = connection ? { ...updated, ...connection, dbUrl: undefined } : updated;
    const next = { ...changed, lastUpdated: Date.now(), version: (previous.version || 0) + 1, remoteVersion: undefined };
    if (hasSharedChanges(next, previous)) {
      pending.current = true;
      editRevision.current++;
      editedAt.current = Date.now();
      // Persist before waiting for React or a network request; reload must not discard an edit.
      try { if (next.syncUrl) markPendingSync(next.syncUrl, true); } catch { setCloudStatus('error'); }
      setCloudStatus('idle');
    }
    apply(next);
  }, [apply]);

  useEffect(() => {
    const url = state.syncUrl, key = state.syncKey;
    if (!url || !key) { setCloudStatus('idle'); return; }
    const abort = new AbortController();
    let active = true, busy = false, ready = false;
    const alive = () => active && !abort.signal.aborted;

    const acknowledge = (remote: AppState, merged: AppState) => {
      base.current = remote;
      pending.current = hasSharedChanges(merged, remote);
      apply(merged);
      try { markPendingSync(url, pending.current); } catch { setCloudStatus('error'); }
      // Failure to persist a baseline never removes the durable pending marker or local records.
      void saveSyncBase(url, remote);
      setLastSyncTime(new Date().toLocaleTimeString());
      setCloudStatus(pending.current ? 'idle' : 'success');
    };

    const pull = async () => {
      if (!alive() || busy || !ready) return;
      busy = true;
      try {
        const remote = (await readCloudSnapshot(url, key, abort.signal)).state;
        if (!alive()) return;
        const local = current.current;
        const merged = base.current || pending.current
          ? mergeConcurrentStates(local, remote, base.current)
          : { state: preserveLocalFields(remote, local), conflicts: [] };
        if (merged.conflicts.length) { setCloudStatus('conflict'); return; }
        acknowledge(remote, merged.state);
      } catch { if (alive()) setCloudStatus('error'); }
      finally { busy = false; }
    };

    const push = async () => {
      if (!alive() || busy || !ready || !pending.current || Date.now() < retryAt.current) return;
      busy = true;
      setIsSyncing(true);
      const sent = current.current;
      const sentRevision = editRevision.current;
      try {
        const result = await syncToCloud(sent, { baseState: base.current, signal: abort.signal });
        if (!alive()) return;
        if (!result.success || !result.newState) {
          setCloudStatus(result.reason === 'conflict' ? 'conflict' : 'error');
          retryAt.current = Date.now() + (result.reason === 'conflict' ? 15000 : 5000);
          return;
        }
        // Apply only edits made since this request started; another user's changes in
        // the acknowledged response must not be replaced by a stale local closure.
        const after = sentRevision === editRevision.current
          ? { state: preserveLocalFields(result.newState, current.current), conflicts: [] }
          : mergeConcurrentStates(current.current, result.newState, sent);
        if (after.conflicts.length) { setCloudStatus('conflict'); return; }
        acknowledge(result.newState, after.state);
        retryAt.current = 0;
      } finally {
        busy = false;
        if (alive()) setIsSyncing(false);
      }
    };

    const initialize = async () => {
      setCloudStatus('loading');
      setIsSyncing(false);
      const savedBase = await loadSyncBase(url);
      if (!alive()) return;
      base.current = savedBase;
      const savedPending = readPendingSync(url);
      pending.current = pending.current || savedPending === true || (savedBase
        ? hasSharedChanges(current.current, savedBase)
        : savedPending === null && current.current.incomeData.length + current.current.operationsData.length + current.current.ownerExpenses.length > 0);
      ready = true;
      await pull();
    };
    const runRefresh = async () => {
      if (!alive() || busy || !ready) return;
      retryAt.current = 0;
      if (pending.current) await push(); else await pull();
    };
    refresh.current = runRefresh;
    void initialize();
    // Failed saves remain pending and retry without requiring another user edit.
    const saveTimer = setInterval(() => {
      if (Date.now() - editedAt.current >= 2500) void push();
    }, 1000);
    const pollTimer = setInterval(() => { void pull(); }, 15000);
    const online = () => { void runRefresh(); };
    window.addEventListener('online', online);
    return () => {
      active = false;
      abort.abort();
      clearInterval(saveTimer);
      clearInterval(pollTimer);
      window.removeEventListener('online', online);
      if (refresh.current === runRefresh) refresh.current = async () => {};
    };
  }, [state.syncUrl, state.syncKey, apply]);

  const refreshCloudStatus = useCallback(() => refresh.current(), []);
  return { state, updateState, isSyncing, cloudStatus, lastSyncTime, refreshCloudStatus };
}
