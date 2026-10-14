import { vi } from 'vitest';
import type { AppState } from './types';

export const fixture = (): AppState => ({
  version: 1, lastUpdated: 1, operators: ['Admin'], models: ['Model'], admins: [],
  accountingPeriods: [{ id: 'period', label: 'October', startAt: '2026-10-01T00:00:00Z', endAt: null, status: 'open' }],
  selectedPeriodId: 'period', incomeData: [], operationsData: [], ownerExpenses: [], ownerAdvances: [],
  modelBonuses: [], paidStatuses: [], deletedIds: [], modelRates: { of: 25, pp: 17, cr: 25 },
  syncUrl: 'https://offline.invalid', syncKey: 'dummy',
});
export const income = (id: string) => ({ id, periodId: 'period', date: '2026-10-13', createdAt: '2026-10-13T00:00:00Z', operator: 'Admin', model: 'Model', onlyFans: 100, paypal: 0, crypto: 0, total: 100, percentOF: 20, percentPP: 20, percentCrypto: 20, nettoOF: 20, nettoPP: 0, nettoCrypto: 0 });
export function fakeDatabase(initial: AppState, firstReaders = 0, fixedTimestamp = false) {
  let state = structuredClone(initial), timestamp = '2026-10-13T00:00:00Z', reads = 0, failures = 0;
  let release: () => void;
  const barrier = new Promise<void>(resolve => { release = resolve; });
  const requests: { method: string; url: URL }[] = [];
  const fetch = vi.fn(async (input: any, options: any = {}) => {
    const url = new URL(String(input), 'https://dashboard.invalid'), method = options.method || 'GET';
    requests.push({ method, url });
    if (method === 'GET') {
      if (failures > 0) { failures--; return new Response('', { status: 503 }); }
      const snapshot = url.searchParams.get('select') === 'id,updated_at,revision:state->>syncRevision' ? { id: 'main', updated_at: timestamp, revision: state.syncRevision || null } : { state: structuredClone(state), updated_at: timestamp };
      reads++;
      if (firstReaders && reads <= firstReaders) {
        if (reads === firstReaders) release!();
        await barrier;
      }
      return new Response(JSON.stringify([snapshot]), { status: 200 });
    }
    if (method !== 'PATCH') throw new Error(`Unsafe method ${method}`);
    const revisionMatches = url.searchParams.get('state->>syncRevision') === (state.syncRevision ? `eq.${state.syncRevision}` : 'is.null');
    const timestampMatches = url.searchParams.get('updated_at') === `eq.${timestamp}`;
    if (!revisionMatches || !timestampMatches) return new Response('[]', { status: 200 });
    const body = JSON.parse(options.body);
    state = body.state;
    if (!fixedTimestamp) timestamp = body.updated_at;
    return new Response(JSON.stringify([{ state, updated_at: timestamp }]), { status: 200 });
  });
  return { fetch, requests, current: () => state, failReads: (count: number) => { failures = count; }, replace: (next: AppState) => { state = structuredClone(next); if (!fixedTimestamp) timestamp = new Date(Date.parse(timestamp) + 1).toISOString(); } };
}
