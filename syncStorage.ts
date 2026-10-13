import type { AppState } from './types';
import { validCloudState } from './cloudSync';

const META_KEY = 'continental_sync_pending_v1';
const normalize = (url: string) => url.trim().replace(/\/$/, '');
export function readPendingSync(url: string): boolean | null {
  try {
    const value = JSON.parse(localStorage.getItem(META_KEY) || 'null');
    return value?.url === normalize(url) ? value.pending === true : null;
  } catch { return null; }
}
export function markPendingSync(url: string, pending: boolean): void {
  localStorage.setItem(META_KEY, JSON.stringify({ url: normalize(url), pending }));
}

// The backup is almost 2 MB even without formatting; use IndexedDB for the baseline
// rather than doubling localStorage usage and exhausting its small browser quota.
async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('continental-sync', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('baselines');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Sync storage is blocked'));
  });
}
export async function loadSyncBase(url: string): Promise<AppState | undefined> {
  let db: IDBDatabase | undefined;
  try {
    db = await database();
    return await new Promise((resolve, reject) => {
      const request = db!.transaction('baselines').objectStore('baselines').get(normalize(url));
      request.onsuccess = () => resolve(validCloudState(request.result) ? request.result : undefined);
      request.onerror = () => reject(request.error);
    });
  } catch { return undefined; } finally { db?.close(); }
}
export async function saveSyncBase(url: string, state: AppState): Promise<void> {
  let db: IDBDatabase | undefined;
  try {
    db = await database();
    await new Promise<void>((resolve, reject) => {
      const tx = db!.transaction('baselines', 'readwrite');
      tx.objectStore('baselines').put(state, normalize(url));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch { /* Local state and the pending marker remain intact; recovery merges conservatively. */ }
  finally { db?.close(); }
}
