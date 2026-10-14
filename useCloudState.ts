import { useCallback, useEffect, useRef, useState } from 'react';
import { createInitialState, saveLocal } from './store';
import { cloudFingerprint, hasSharedChanges, mergeConcurrentStates, preserveLocalFields, readCloudSnapshot, readCloudTimestamp, syncToCloud, type RecoveryItem } from './cloudSync';
import { archiveRecovery, dismissRecoveryItem, loadRecoveries, loadSyncBase, markPendingSync, readPendingSync, saveSyncBase, type RecoveryNotice } from './syncStorage';
import { applyRecoveryChoice } from './syncRecovery';
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
  const [recoveries, setRecoveries] = useState<RecoveryNotice[]>([]);
  const current = useRef(state);
  const base = useRef<AppState>();
  const pending = useRef(false);
  const editRevision = useRef(0);
  const editedAt = useRef(0);
  const retryAt = useRef(0);
  const refresh = useRef<() => Promise<void>>(async () => {});

  const apply = useCallback((next: AppState) => {
    // Never replace the rendered state if its durable local copy cannot be saved.
    try { saveLocal(next); } catch { setCloudStatus('error'); return false; }
    current.current = next;
    setState(next);
    return true;
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
    return apply(next);
  }, [apply]);

  useEffect(() => {
    const url = state.syncUrl, key = state.syncKey;
    if (!url || !key) { setCloudStatus('idle'); return; }
    const abort = new AbortController();
    let active = true, busy = false, ready = false;
    let timestamp: string | null | undefined;
    const alive = () => active && !abort.signal.aborted;

    const acknowledge = (remote: AppState, merged: AppState) => {
      if (!apply(merged)) return false;
      base.current = remote;
      pending.current = hasSharedChanges(merged, remote);
      try { markPendingSync(url, pending.current); } catch { setCloudStatus('error'); }
      // Failure to persist a baseline never removes the durable pending marker or local records.
      void saveSyncBase(url, remote);
      setLastSyncTime(new Date().toLocaleTimeString());
      setCloudStatus(pending.current ? 'idle' : 'success');
      return true;
    };

    const acceptRemote = async (remote: AppState) => {
      const local = current.current, revision = editRevision.current;
      const merged = base.current || pending.current
        ? mergeConcurrentStates(local, remote, base.current, true)
        : { state: preserveLocalFields(remote, local), conflicts: [], recovery: [] };
      if (merged.recovery.length) {
        try {
          const notices = await archiveRecovery(url, local, remote, base.current, merged.recovery);
          if (!alive()) return;
          setRecoveries(notices);
        } catch { if (alive()) setCloudStatus('conflict'); return; }
        // Edits made while IndexedDB commits remain in place and are merged next time.
        if (revision !== editRevision.current) return;
      }
      if (alive()) return acknowledge(remote, merged.state);
    };

    const pull = async (force = false) => {
      if (!alive() || busy || !ready) return;
      busy = true;
      try {
        if (!force && !pending.current && timestamp !== undefined) {
          const latest = await readCloudTimestamp(url, key, abort.signal);
          if (!alive()) return;
          if (!pending.current && latest === timestamp) {
            setLastSyncTime(new Date().toLocaleTimeString());
            setCloudStatus('success');
            return;
          }
        }
        const snapshot = await readCloudSnapshot(url, key, abort.signal);
        if (!alive()) return;
        timestamp = await acceptRemote(snapshot.state) ? cloudFingerprint(snapshot.updated_at, snapshot.state.syncRevision) : undefined;
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
          if (result.reason === 'conflict') {
            const snapshot = await readCloudSnapshot(url, key, abort.signal);
            if (alive()) timestamp = await acceptRemote(snapshot.state) ? cloudFingerprint(snapshot.updated_at, snapshot.state.syncRevision) : undefined;
            return;
          }
          setCloudStatus('error');
          retryAt.current = Date.now() + 5000;
          return;
        }
        // Apply only edits made since this request started; another user's changes in
        // the acknowledged response must not be replaced by a stale local closure.
        const after = sentRevision === editRevision.current
          ? { state: preserveLocalFields(result.newState, current.current), conflicts: [] }
          : mergeConcurrentStates(current.current, result.newState, sent);
        if (after.conflicts.length) { await acceptRemote(result.newState); return; }
        acknowledge(result.newState, after.state);
        timestamp = undefined;
        retryAt.current = 0;
      } catch {
        if (alive()) { setCloudStatus('error'); retryAt.current = Date.now() + 5000; }
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
      try { const notices = await loadRecoveries(url); if (alive()) setRecoveries(notices); }
      catch { /* Recovery creation still fails closed if this browser cannot store backups. */ }
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
      if (pending.current) await push(); else await pull(true);
    };
    refresh.current = runRefresh;
    void initialize();
    // Failed saves remain pending and retry without requiring another user edit.
    const saveTimer = setInterval(() => {
      if (Date.now() - editedAt.current >= 2500) void push();
    }, 1000);
    const pollTimer = setInterval(() => { if (typeof document === 'undefined' || document.visibilityState !== 'hidden') void pull(); }, 5000);
    const online = () => { void runRefresh(); };
    const visible = () => { if (document.visibilityState === 'visible') void runRefresh(); };
    window.addEventListener('online', online);
    window.addEventListener('focus', online);
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', visible);
    return () => {
      active = false;
      abort.abort();
      clearInterval(saveTimer);
      clearInterval(pollTimer);
      window.removeEventListener('online', online);
      window.removeEventListener('focus', online);
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', visible);
      if (refresh.current === runRefresh) refresh.current = async () => {};
    };
  }, [state.syncUrl, state.syncKey, apply]);

  const refreshCloudStatus = useCallback(() => refresh.current(), []);
  const resolveRecovery = useCallback(async (notice: RecoveryNotice, item: RecoveryItem, useLocal: boolean, expected: any) => {
    if (useLocal && !updateState(previous => applyRecoveryChoice(previous, item, expected))) throw new Error('Не удалось сохранить выбор на устройстве. Освободите место и повторите.');
    const notices = await dismissRecoveryItem(current.current.syncUrl!, notice.id, item.field);
    setRecoveries(notices);
  }, [updateState]);
  return { state, updateState, isSyncing, cloudStatus, lastSyncTime, refreshCloudStatus, recoveries, resolveRecovery };
}
