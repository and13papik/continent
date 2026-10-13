import type { AppState } from './types';

const LOCAL_FIELDS = new Set(['syncUrl', 'syncKey', 'dbUrl', 'selectedPeriodId']);
const SYNC_FIELDS = new Set(['version', 'lastUpdated', 'lastSyncedAt', 'remoteVersion', 'syncRevision']);
const ignored = (key: string) => LOCAL_FIELDS.has(key) || SYNC_FIELDS.has(key);
const isObject = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value);

export function sameValue(a: any, b: any): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((value, index) => sameValue(value, b[index]));
  if (isObject(a) && isObject(b)) {
    const keys = Object.keys(a).filter(key => a[key] !== undefined);
    return keys.length === Object.keys(b).filter(key => b[key] !== undefined).length && keys.every(key => sameValue(a[key], b[key]));
  }
  return false;
}

export function hasSharedChanges(a: AppState, b: AppState): boolean {
  const emptyDefault = (value: any) => value === '' || (Array.isArray(value) && value.length === 0) || (isObject(value) && Object.keys(value).length === 0);
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].some(key => {
    if (ignored(key)) return false;
    const left = (a as any)[key], right = (b as any)[key];
    if (key === 'deletedIds' && Array.isArray(left) && Array.isArray(right)) {
      const leftSet = new Set(left.map(String)), rightSet = new Set(right.map(String));
      return leftSet.size !== rightSet.size || [...leftSet].some(id => !rightSet.has(id));
    }
    // createInitialState supplies empty optional collections for older backups.
    // Hydrating those defaults is not a user edit and must not trigger a cloud write.
    if ((left === undefined && emptyDefault(right)) || (right === undefined && emptyDefault(left))) return false;
    return !sameValue(left, right);
  });
}

export function preserveLocalFields(remote: AppState, local: AppState): AppState {
  return { ...remote, syncUrl: local.syncUrl, syncKey: local.syncKey, dbUrl: local.dbUrl,
    selectedPeriodId: remote.accountingPeriods.some(period => period.id === local.selectedPeriodId) ? local.selectedPeriodId : remote.selectedPeriodId };
}

/** Merge against the state this browser actually saw, never against wall-clock ordering. */
export function mergeConcurrentStates(local: AppState, remote: AppState, base?: AppState): { state: AppState; conflicts: string[] } {
  const conflicts: string[] = [];
  // A tab with the old unconditional writer can remove or reuse the revision.
  // Never treat that overwrite as a legitimate deletion of already saved records.
  if (base?.syncRevision && (!remote.syncRevision || (base.syncRevision === remote.syncRevision && hasSharedChanges(base, remote)))) {
    return { state: local, conflicts: ['syncRevision'] };
  }
  const localDeleted = new Set((local.deletedIds || []).map(String));
  const remoteDeleted = new Set((remote.deletedIds || []).map(String));
  const merge = (old: any, left: any, right: any, field: string): any => {
    if (sameValue(left, right)) return right;
    if (base && sameValue(left, old)) return right;
    if (base && sameValue(right, old)) return left;
    if (!base && left === undefined) return right;
    if (!base && right === undefined) return left;
    // A concurrent edit and deletion must be reviewed, rather than silently losing the edit.
    if (left === undefined || right === undefined) { conflicts.push(field); return left; }
    if (isObject(left) && isObject(right) && (old === undefined || isObject(old))) {
      const result: Record<string, any> = {};
      for (const key of new Set([...Object.keys(old || {}), ...Object.keys(left), ...Object.keys(right)])) {
        if (key === 'updatedAt') { result[key] = [left[key], right[key]].filter(Boolean).sort().at(-1); continue; }
        const value = merge(old?.[key], left[key], right[key], `${field}.${key}`);
        if (value !== undefined) result[key] = value;
      }
      return result;
    }
    if (Array.isArray(left) && Array.isArray(right) && (old === undefined || Array.isArray(old))) {
      const all = [...(old || []), ...left, ...right];
      if (all.every(value => isObject(value) && typeof value.id === 'string')) {
        const maps = [old || [], left, right].map(rows => new Map(rows.map((row: any) => [row.id, row])));
        // Preserve cloud ordering and append independently added local records.
        const ids = new Set([...maps[2].keys(), ...maps[1].keys(), ...maps[0].keys()]);
        const result: any[] = [];
        for (const id of ids) {
          const value = merge(maps[0].get(id), localDeleted.has(String(id)) ? undefined : maps[1].get(id), remoteDeleted.has(String(id)) ? undefined : maps[2].get(id), `${field}[${id}]`);
          if (value !== undefined) result.push(value);
        }
        return result;
      }
      if (all.every(value => value === null || ['string', 'number', 'boolean'].includes(typeof value))) {
        const oldSet = new Set(old || []), leftSet = new Set(left), rightSet = new Set(right);
        return [...new Set([...right, ...left])].filter(value => !oldSet.has(value) || (leftSet.has(value) && rightSet.has(value)));
      }
    }
    conflicts.push(field);
    return left;
  };
  const result: any = { ...remote };
  for (const key of new Set([...Object.keys(base || {}), ...Object.keys(local), ...Object.keys(remote)])) {
    if (ignored(key) || key === 'deletedIds') continue;
    const left = (local as any)[key], right = (remote as any)[key];
    const withoutDeleted = (rows: any, deleted: Set<string>) => Array.isArray(rows) && rows.every(row => isObject(row) && typeof row.id === 'string')
      ? rows.filter(row => !deleted.has(row.id)) : rows;
    const value = merge((base as any)?.[key], withoutDeleted(left, localDeleted), withoutDeleted(right, remoteDeleted), key);
    if (value === undefined) delete result[key]; else result[key] = value;
  }
  result.deletedIds = [...new Set([...localDeleted, ...remoteDeleted])];
  return { state: preserveLocalFields(result, local), conflicts };
}

export function validCloudState(state: any): state is AppState {
  return isObject(state) && Number.isFinite(state.version) && Number.isFinite(state.lastUpdated) &&
    ['accountingPeriods', 'incomeData', 'operationsData', 'ownerExpenses', 'deletedIds'].every(key => Array.isArray(state[key])) &&
    state.accountingPeriods.length > 0 && state.accountingPeriods.every((period: any) => isObject(period) && typeof period.id === 'string') &&
    (state.syncRevision === undefined || typeof state.syncRevision === 'string');
}

function requestSignal(ms: number, signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(ms);
  return signal && typeof AbortSignal.any === 'function' ? AbortSignal.any([signal, timeout]) : timeout;
}

export async function readCloudSnapshot(url: string, key: string, signal?: AbortSignal): Promise<{ state: AppState; updated_at: string | null }> {
  const endpoint = new URL('/rest/v1/app_storage', url.trim().replace(/\/$/, '') + '/');
  endpoint.search = new URLSearchParams({ id: 'eq.main', select: 'state,updated_at' }).toString();
  const response = await fetch(endpoint, { headers: { apikey: key.trim(), Authorization: `Bearer ${key.trim()}`, 'Cache-Control': 'no-cache' }, signal: requestSignal(12000, signal) });
  if (!response.ok) throw new Error(`Cloud read failed (${response.status})`);
  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length !== 1 || !validCloudState(rows[0].state) || !(rows[0].updated_at === null || typeof rows[0].updated_at === 'string')) throw new Error('Cloud main record is missing or invalid');
  return rows[0];
}

export type SyncResult = { success: boolean; newState?: AppState; reason?: 'read' | 'write' | 'conflict' | 'busy'; conflicts?: string[] };

/** Conditional PATCH is a compare-and-swap in PostgreSQL; no schema migration is needed. */
export async function syncToCloud(state: AppState, options: { baseState?: AppState; signal?: AbortSignal } = {}): Promise<SyncResult> {
  if (!state.syncUrl || !state.syncKey || !validCloudState(state)) return { success: false, reason: 'read' };
  for (let attempt = 0; attempt < 8; attempt++) {
    let snapshot;
    try { snapshot = await readCloudSnapshot(state.syncUrl, state.syncKey, options.signal); }
    catch { return { success: false, reason: 'read' }; }
    if (options.signal?.aborted) return { success: false, reason: 'read' };
    const merged = mergeConcurrentStates(state, snapshot.state, options.baseState);
    if (merged.conflicts.length) return { success: false, reason: 'conflict', conflicts: merged.conflicts };
    if (!hasSharedChanges(merged.state, snapshot.state)) return { success: true, newState: preserveLocalFields(snapshot.state, state) };
    const revision = globalThis.crypto.randomUUID();
    const newState = { ...merged.state, version: Math.max(state.version, snapshot.state.version) + 1,
      lastUpdated: Math.max(Date.now(), snapshot.state.lastUpdated + 1), lastSyncedAt: new Date().toISOString(), syncRevision: revision };
    const endpoint = new URL('/rest/v1/app_storage', state.syncUrl.trim().replace(/\/$/, '') + '/');
    endpoint.search = new URLSearchParams({ id: 'eq.main', select: 'state,updated_at',
      updated_at: snapshot.updated_at === null ? 'is.null' : `eq.${snapshot.updated_at}`,
      'state->>syncRevision': snapshot.state.syncRevision ? `eq.${snapshot.state.syncRevision}` : 'is.null' }).toString();
    try {
      const response = await fetch(endpoint, { method: 'PATCH', headers: { apikey: state.syncKey.trim(), Authorization: `Bearer ${state.syncKey.trim()}`,
        'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ state: newState, updated_at: new Date().toISOString() }), signal: requestSignal(15000, options.signal) });
      if (!response.ok) return { success: false, reason: 'write' };
      const rows = await response.json();
      if (Array.isArray(rows) && rows.length === 0) continue; // Another browser committed first: read and merge again.
      if (!Array.isArray(rows) || rows.length !== 1 || !validCloudState(rows[0].state) || rows[0].state.syncRevision !== revision) return { success: false, reason: 'write' };
      return { success: true, newState: preserveLocalFields(rows[0].state, state) };
    } catch { return { success: false, reason: 'write' }; }
  }
  return { success: false, reason: 'busy' };
}
