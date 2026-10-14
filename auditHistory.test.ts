import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readAuditHistory } from './api/_lib/audit';
import { getSupabaseCredentials } from './api/_lib/supabase';
import { auditChanges, auditValue } from './auditHistory';
vi.mock('./api/_lib/supabase', () => ({ getSupabaseCredentials: vi.fn() }));
const owner = { id: 'owner-id', username: 'owner', role: 'owner' as const, cloudUrl: 'https://database.invalid' };
function response() {
  const res: any = { headers: {}, setHeader(key: string, value: string) { res.headers[key] = value; }, status(code: number) { res.code = code; return res; }, json(value: any) { res.body = value; return res; } };
  return res;
}
async function invoke(query = '', role: 'owner' | 'admin' = 'owner', method = 'GET') {
  const res = response(); await readAuditHistory({ method, url: `/api/cloud?view=audit${query}` }, res, { ...owner, role }); return res;
}
beforeEach(() => {
  vi.mocked(getSupabaseCredentials).mockResolvedValue({ url: 'https://database.invalid', key: 'server-secret' });
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([]))));
});
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); });
describe('private paginated audit history', () => {
  it('rejects admins before accessing history', async () => { expect((await invoke('', 'admin')).code).toBe(403); expect(fetch).not.toHaveBeenCalled(); });
  it('never accepts changes to history', async () => { expect((await invoke('', 'owner', 'PATCH')).code).toBe(405); expect(fetch).not.toHaveBeenCalled(); });
  it.each(['&eventId=0','&cursor=9223372036854775808','&eventId=eq.1','&collection=__proto__','&collection=syncKey','&action=anything'])('rejects invalid filters %s', async query => { expect((await invoke(query)).code).toBe(400); expect(fetch).not.toHaveBeenCalled(); });
  it('lists only metadata, with stable bigint pagination and fixed bounds', async () => {
    const events = Array.from({ length: 51 }, (_, i) => ({ id: String(9007199254741051n - BigInt(i)), collection: 'incomeData' }));
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(events)));
    const res = await invoke('&collection=incomeData&action=update&cursor=9007199254742000');
    expect(res.code).toBe(200); expect(res.body.events).toHaveLength(50); expect(res.body.nextCursor).toBe('9007199254741002');
    const url = new URL(String(vi.mocked(fetch).mock.calls[0][0]));
    expect(url.pathname).toBe('/rest/v1/app_audit_events'); expect(url.searchParams.get('select')).not.toContain('value');
    expect(url.searchParams.get('id')).toBe('lt.9007199254742000'); expect(url.searchParams.get('limit')).toBe('51');
    expect(url.searchParams.get('collection')).toBe('eq.incomeData'); expect(url.searchParams.get('action')).toBe('eq.update');
    expect(res.headers['Cache-Control']).toBe('no-store');
  });
  it('returns before/after only for an explicit owner detail request', async () => {
    const event = { id: '42', before_value: { amount: 10 }, after_value: { amount: 20 } };
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify([event])));
    const res = await invoke('&eventId=42'); expect(res.code).toBe(200); expect(res.body).toEqual(event);
    expect(new URL(String(vi.mocked(fetch).mock.calls[0][0])).searchParams.get('select')).toContain('before_value,after_value');
  });
  it('returns 404 for a missing event', async () => expect((await invoke('&eventId=42')).code).toBe(404));
  it('does not report a database failure as empty successful history', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('server-secret', { status: 500 }));
    const res = await invoke(); expect(res.code).toBe(502); expect(JSON.stringify(res.body)).not.toContain('server-secret');
  });
  it('rejects numeric IDs that could lose precision', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify([{ id: 9007199254740992 }])));
    expect((await invoke()).code).toBe(502);
  });
});
describe('readable before/after values', () => {
  it('shows nested amount changes but ignores technical row timestamps', () => {
    expect(auditChanges({ id: '1', night: { balance: 10 }, updatedAt: 'old' }, { id: '1', night: { balance: 20 }, updatedAt: 'new' })).toEqual([{ field: 'Ночь → Доход', before: 10, after: 20 }]);
  });
  it('includes deleted values and preserves zero versus missing', () => {
    expect(auditChanges({ amount: 0 }, null)).toEqual([{ field: 'Сумма', before: 0, after: undefined }]);
    expect(auditValue(0)).toBe('0'); expect(auditValue(null)).toBe('—');
  });
  it('preserves exact free text even if it resembles a status', () => {
    expect(auditValue('open', 'Комментарий')).toBe('open'); expect(auditValue('open', 'Статус')).toBe('Открыт');
  });
});
