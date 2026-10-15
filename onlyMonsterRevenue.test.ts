import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAllAccountsShiftEarnings } from './api/onlymonster/analytics';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('OnlyMonster account revenue', () => {
  const setup = () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T13:00:00Z'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
  };
  it('uses the platform account id rather than the internal creator id', async () => {
    setup();
    const fetchMock = vi.fn(async (url: string) => new Response(JSON.stringify(url.includes('/transactions')
      ? { transactions: [{ timestamp: '2026-10-15T12:00:00Z', price_gross: 100 }] }
      : { accounts: [{ id: 'internal-20', platform_account_id: 'platform-46' }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await getAllAccountsShiftEarnings('test-token', 'today')).toEqual({ 1: 0, 2: 0, 3: 80, 4: 0 });
    expect(fetchMock.mock.calls[1][0]).toContain('/accounts/platform-46/transactions');
  });
  it('does not turn an unavailable account into zero income', async () => {
    setup();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 503 })));
    expect(await getAllAccountsShiftEarnings('test-token', 'today', ['platform-46'])).toBeNull();
  });
  it('keeps a real empty transaction list as zero', async () => {
    setup();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"transactions":[]}')));
    expect(await getAllAccountsShiftEarnings('test-token', 'today', ['platform-46'])).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0 });
  });
  it('does not present a partial account sum as a complete total', async () => {
    setup();
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.includes('/unavailable/')
      ? new Response('{}', { status: 503 })
      : new Response('{"transactions":[{"timestamp":"2026-10-15T12:00:00Z","price_gross":100}]}')));
    expect(await getAllAccountsShiftEarnings('test-token', 'today', ['available', 'unavailable'])).toBeNull();
  });
});
