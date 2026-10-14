import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import authHandler from './api/auth';
import cloudHandler from './api/cloud';
import telegramHandler from './api/telegram';
import configHandler from './api/onlymonster/config';
import { dashboardUser, loginIdentity, requireSession } from './api/_lib/auth';
import { cloudFetch } from './cloudTransport';
import { fixture, income } from './syncTestFixtures';
import { adminView } from './stateAccess';

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), signInWithPassword: vi.fn(), refreshSession: vi.fn(), signOut: vi.fn(), getCreds: vi.fn(), getOmToken: vi.fn(), setOmToken: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: { getUser: mocks.getUser, signInWithPassword: mocks.signInWithPassword, refreshSession: mocks.refreshSession, admin: { signOut: mocks.signOut } } }) }));
vi.mock('./api/_lib/supabase', () => ({ getSupabaseCredentials: mocks.getCreds }));
vi.mock('./api/_lib/om-store', () => ({ getOmToken: mocks.getOmToken, setOmToken: mocks.setOmToken, getOmWebhookId: async () => 'webhook-id', setOmWebhookId: vi.fn(), isKvConfigured: () => false, isPlaceholderToken: (value: string) => !value }));
vi.mock('./api/onlymonster/analytics', () => ({ clearAuthFailure: vi.fn() }));

function response() {
  const result: any = { statusCode: 200, headers: {} };
  result.setHeader = (key: string, value: any) => { result.headers[key] = value; };
  result.status = (status: number) => { result.statusCode = status; return result; };
  result.json = (body: any) => { result.body = body; return result; };
  return result;
}
function request(method = 'GET', body?: any) {
  return { method, body, url: '/api/cloud?id=eq.main', headers: { cookie: '__Host-continental-access=fake-access', origin: 'https://dashboard.invalid' } };
}
function actor(role: 'admin' | 'owner' = 'owner', username = 'owner_fixture') {
  return { id: `id-${username}`, email_confirmed_at: '2026-01-01', app_metadata: { continental_role: role, continental_username: username }, user_metadata: {} };
}
const session = { access_token: 'server-only-access', refresh_token: 'server-only-refresh' };
beforeEach(() => {
  vi.stubEnv('APP_ORIGIN', 'https://dashboard.invalid');
  vi.stubEnv('SUPABASE_URL', 'https://database.invalid');
  vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'fake-public-key');
  mocks.getUser.mockResolvedValue({ data: { user: actor() }, error: null });
  mocks.signInWithPassword.mockResolvedValue({ data: { session, user: actor() }, error: null });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.getCreds.mockResolvedValue({ url: 'https://database.invalid', key: 'private-database-key' });
  mocks.getOmToken.mockResolvedValue('private-onlymonster-token');
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('Unexpected network call'); }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe('server authentication', () => {
  it.each(['@Admin_One', 'admin_one', ' admin_one '])('normalizes username without requiring an email (%s)', username => {
    expect(loginIdentity(username)).toBe('admin_one@accounts.continental.invalid');
  });
  it.each(['owner@example.com', '../owner', '', 'a', null])('rejects invalid usernames (%s)', username => expect(loginIdentity(username)).toBeNull());
  it('does not trust editable user metadata or unconfirmed accounts', () => {
    expect(dashboardUser({ ...actor(), app_metadata: {}, user_metadata: { continental_role: 'owner' } } as any)).toBeNull();
    expect(dashboardUser({ ...actor(), email_confirmed_at: undefined } as any)).toBeNull();
  });
  it.each([['owner_shared', 'owner'], ['admin_one', 'admin'], ['admin_two', 'admin']] as const)('logs in %s with a server assigned %s role', async (username, role) => {
    mocks.signInWithPassword.mockResolvedValue({ data: { session, user: actor(role, username) }, error: null });
    const res = response();
    await authHandler(request('POST', { action: 'login', username: `@${username}`, password: 'synthetic-test-password', role: 'owner' }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.user).toMatchObject({ username, role });
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({ email: `${username}@accounts.continental.invalid`, password: 'synthetic-test-password' });
    expect(res.headers['Set-Cookie']).toHaveLength(2);
    for (const cookie of res.headers['Set-Cookie']) expect(cookie).toMatch(/Path=\/; HttpOnly; SameSite=Strict; Secure/);
    expect(JSON.stringify(res.body)).not.toContain('server-only');
    expect(res.headers['Cache-Control']).toBe('no-store');
  });
  it('rejects a wrong password without issuing cookies', async () => {
    mocks.signInWithPassword.mockResolvedValue({ data: {}, error: { status: 400 } });
    const res = response(); await authHandler(request('POST', { action: 'login', username: 'owner_test', password: 'wrong' }), res);
    expect(res.statusCode).toBe(401); expect(res.headers['Set-Cookie']).toBeUndefined();
  });
  it.each(['https://attacker.invalid', undefined])('blocks foreign or missing origins (%s)', async origin => {
    const req: any = request('POST', { action: 'login', username: 'owner_test', password: 'test' }); req.headers.origin = origin;
    const res = response(); await authHandler(req, res);
    expect(res.statusCode).toBe(403); expect(mocks.signInWithPassword).not.toHaveBeenCalled();
  });
  it('ignores old local role/auth flags and forged authorization headers', async () => {
    const req: any = request(); req.headers = { authorization: 'Bearer owner', cookie: 'continental_auth=true; continental_role=owner' };
    const res = response(); expect(await requireSession(req, res)).toBeNull(); expect(res.statusCode).toBe(401);
  });
  it('rejects forged and expired access cookies', async () => {
    mocks.getUser.mockResolvedValue({ data: {}, error: { status: 401 } });
    const res = response(); await requireSession(request(), res);
    expect(res.statusCode).toBe(401);
  });
  it('rejects admin access to an owner-only endpoint', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: actor('admin') }, error: null });
    const res = response(); await requireSession(request(), res, true); expect(res.statusCode).toBe(403);
  });
  it('checks role changes on the next request', async () => {
    expect(await requireSession(request(), response(), true)).toBeTruthy();
    mocks.getUser.mockResolvedValue({ data: { user: actor('admin') }, error: null });
    const res = response(); expect(await requireSession(request(), res, true)).toBeNull(); expect(res.statusCode).toBe(403);
  });
  it('logs out and expires both cookies without deleting local financial data', async () => {
    const res = response(); await authHandler(request('POST', { action: 'logout' }), res);
    expect(res.statusCode).toBe(200); expect(res.headers['Set-Cookie'].every((value: string) => value.endsWith('Max-Age=0'))).toBe(true);
  });
  it('renews a session without exposing tokens', async () => {
    mocks.refreshSession.mockResolvedValue({ data: { session, user: actor() }, error: null });
    const req = request('POST', { action: 'refresh' }); req.headers.cookie += '; __Host-continental-refresh=fake-refresh';
    const res = response(); await authHandler(req, res); expect(res.statusCode).toBe(200); expect(res.body.user.role).toBe('owner');
    expect(JSON.stringify(res.body)).not.toContain('server-only');
  });
});

describe('protected integrations', () => {
  it.each([configHandler, telegramHandler, cloudHandler])('rejects anonymous calls before any secret or network access', async handler => {
    const req = request(); req.headers.cookie = '';
    const res = response(); await handler(req, res);
    expect(res.statusCode).toBe(401); expect(fetch).not.toHaveBeenCalled(); expect(mocks.getOmToken).not.toHaveBeenCalled();
  });
  it('returns OnlyMonster configuration status without its token', async () => {
    const res = response(); await configHandler(request(), res);
    expect(res.statusCode).toBe(200); expect(res.body.apiKeyConfigured).toBe(true);
    expect(res.body).not.toHaveProperty('token'); expect(JSON.stringify(res.body)).not.toContain('private-');
  });
  it('does not let admins change integration configuration', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: actor('admin') }, error: null });
    const res = response(); await configHandler(request('POST', { token: 'replacement' }), res);
    expect(res.statusCode).toBe(403); expect(mocks.setOmToken).not.toHaveBeenCalled();
  });
  it('allows owner configuration updates without echoing secrets', async () => {
    const res = response(); await configHandler(request('POST', { token: 'replacement' }), res);
    expect(res.statusCode).toBe(200); expect(mocks.setOmToken).toHaveBeenCalledWith('replacement'); expect(res.body).not.toHaveProperty('token');
  });
  it('never accepts a Telegram recipient outside the server allowlist', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 'fake-bot'); vi.stubEnv('TELEGRAM_CHAT_ID', '-123');
    const res = response(); await telegramHandler(request('POST', { action: 'sendMessage', chat_id: '-456', text: 'test' }), res);
    expect(res.statusCode).toBe(403); expect(fetch).not.toHaveBeenCalled();
  });
  it('sends through the fixed Telegram endpoint and returns only the receipt', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 'fake-bot'); vi.stubEnv('TELEGRAM_CHAT_ID', '-123');
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ ok: true, result: { message_id: 123, text: 'private message' } })));
    const res = response(); await telegramHandler(request('POST', { action: 'sendMessage', text: 'test' }), res);
    expect(res.statusCode).toBe(200); expect(res.body).toEqual({ ok: true, result: { message_id: 123 } });
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toBe('https://api.telegram.org/botfake-bot/sendMessage');
  });
  it('does not reflect token-bearing network errors', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 'fake-bot'); vi.stubEnv('TELEGRAM_CHAT_ID', '-123');
    vi.mocked(fetch).mockRejectedValue(new Error('https://api.telegram.org/botfake-bot/sendMessage failed'));
    const res = response(); await telegramHandler(request('POST', { action: 'sendMessage', text: 'test' }), res);
    expect(res.statusCode).toBe(502); expect(JSON.stringify(res.body)).not.toContain('fake-bot');
  });
});

describe('authenticated cloud data', () => {
  const timestamp = '2026-10-13T00:00:00Z';
  function writeRequest(state = fixture()) {
    const req = request('PATCH', { state: { ...state, incomeData: [income('new')], version: 2, syncRevision: 'new-revision' }, updated_at: timestamp });
    req.url += '&updated_at=eq.' + timestamp + '&state-%3E%3EsyncRevision=is.null';
    return req;
  }
  const privateState = () => ({...fixture(), ownerDocument:'OWNER SECRET', ownerExpenses:[{id:'expense',amount:100}],
    ownerManualIncomes:[{id:'manual',periodId:'period',amount:50,comment:'OWNER SECRET'}],
    ownerTasks:[{id:'hidden',assignedTo:'Andrey',title:'OWNER SECRET'},{id:'shared',assignedTo:'Admins',title:'Shared'}],futurePrivate:'OWNER SECRET'} as any);
  it.each(['state','state,updated_at','id,state,updated_at'])('redacts admin reads for projection %s', async select => {
    mocks.getUser.mockResolvedValue({data:{user:actor('admin')},error:null});
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify([{state:privateState(),updated_at:timestamp}])));
    const req=request();req.url+='&select='+select;const res=response();await cloudHandler(req,res);
    expect(res.statusCode).toBe(200);expect(JSON.stringify(res.body)).not.toContain('OWNER SECRET');
    expect(res.body[0].state.manualIncomeTotals.period).toBe(50);expect(res.body[0].state.ownerExpenses).toEqual([]);
  });
  it('retains complete owner reads',async()=>{
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify([{state:privateState(),updated_at:timestamp}])));
    const res=response();await cloudHandler(request(),res);expect(res.body[0].state.ownerDocument).toBe('OWNER SECRET');
  });
  it('keeps private records intact during an admin save and redacts the PATCH response',async()=>{
    mocks.getUser.mockResolvedValue({data:{user:actor('admin')},error:null});const before=privateState();
    vi.mocked(fetch).mockImplementation(async (_input, options) => new Response(JSON.stringify(options?.method === 'PATCH' ? [{ ...JSON.parse(options.body as string) }] : [{ state: before, updated_at: timestamp }])));
    const req=writeRequest(adminView(before));req.body.state.ownerTasks[0].title='Admin progress';req.body.state.manualIncomeTotals.period=999;
    const res=response();await cloudHandler(req,res);expect(res.statusCode).toBe(200);
    const saved=JSON.parse(vi.mocked(fetch).mock.calls[1][1]!.body as string).state;
    expect(saved.ownerExpenses).toEqual(before.ownerExpenses);expect(saved.ownerDocument).toEqual(before.ownerDocument);
    expect(saved.ownerTasks.find((task:any)=>task.id==='hidden')).toEqual(before.ownerTasks[0]);
    expect(saved.ownerTasks.map((task:any)=>task.id)).toEqual(before.ownerTasks.map((task:any)=>task.id));
    expect(saved.ownerTasks.find((task:any)=>task.id==='shared').title).toBe('Admin progress');
    expect(saved.futurePrivate).toBe('OWNER SECRET');expect(saved.accessScope).toBeUndefined();expect(saved.manualIncomeTotals).toBeUndefined();
    expect(res.body[0].state.manualIncomeTotals.period).toBe(50);expect(JSON.stringify(res.body)).not.toContain('OWNER SECRET');
  });
  it.each(['task','tombstone','unknown','period'])('blocks admin modification of hidden data through %s',async(kind)=>{
    mocks.getUser.mockResolvedValue({data:{user:actor('admin')},error:null});const before=privateState();
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify([{state:before,updated_at:timestamp}])));
    const req=writeRequest(adminView(before));
    if(kind==='task')req.body.state.ownerTasks.push({id:'hidden',assignedTo:'Admins',title:'Forged'});
    if(kind==='tombstone')req.body.state.deletedIds.push('hidden');
    if(kind==='unknown')req.body.state.futurePrivate='Forged';
    if(kind==='period')req.body.state.accountingPeriods[0].status='closed';
    const res=response();await cloudHandler(req,res);expect(res.statusCode).toBe(403);expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('prevents an old admin projection being saved as a full owner state after an account switch',async()=>{
    const res=response();await cloudHandler(writeRequest(adminView(privateState())),res);
    expect(res.statusCode).toBe(409);expect(fetch).not.toHaveBeenCalled();
  });
  it('rejects creating the same calendar month with a different ID on the server',async()=>{
    const before=fixture();vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify([{state:before,updated_at:timestamp}])));
    const req=writeRequest();req.body.state.accountingPeriods.push({...before.accountingPeriods[0],id:'duplicate',label:'Another name'});
    const res=response();await cloudHandler(req,res);expect(res.statusCode).toBe(400);expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('does not expose snapshots or extra projection fields to admins',async()=>{
    mocks.getUser.mockResolvedValue({data:{user:actor('admin')},error:null});
    for(const url of ['/api/cloud','/api/cloud?id=eq.backup','/api/cloud?id=eq.main&select=*']){
      const req=request();req.url=url;const res=response();await cloudHandler(req,res);expect([400,403]).toContain(res.statusCode);
    }
    expect(fetch).not.toHaveBeenCalled();
  });
  it('strips database secrets from reads', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify([{ state: { ...fixture(), syncKey: 'private-key', dbUrl: 'private-url' }, updated_at: timestamp }])));
    const res = response(); await cloudHandler(request(), res);
    expect(res.statusCode).toBe(200); expect(res.body[0].state.incomeData).toEqual([]); expect(res.body[0].state).not.toHaveProperty('syncKey'); expect(res.body[0].state).not.toHaveProperty('dbUrl');
  });
  it('requires compare-and-swap conditions for all saves', async () => {
    const res = response(); await cloudHandler(request('PATCH', { state: fixture() }), res);
    expect(res.statusCode).toBe(400); expect(fetch).not.toHaveBeenCalled();
  });
  it('preserves every unrelated field and applies both CAS filters', async () => {
    const before = { ...fixture(), cryptoWallets: [{ id: 'keep-me' }] };
    vi.mocked(fetch).mockImplementation(async (_input, options) => new Response(JSON.stringify(options?.method === 'PATCH' ? [{ ...JSON.parse(options.body as string) }] : [{ state: before, updated_at: timestamp }])));
    const res = response(); await cloudHandler(writeRequest(), res);
    expect(res.statusCode).toBe(200);
    const [url, options] = vi.mocked(fetch).mock.calls[1];
    expect(new URL(String(url)).searchParams.get('updated_at')).toBe('eq.' + timestamp);
    expect(new URL(String(url)).searchParams.get('state->>syncRevision')).toBe('is.null');
    const saved = JSON.parse(options!.body as string).state;
    expect(saved.cryptoWallets).toEqual(before.cryptoWallets); expect(saved.ownerExpenses).toEqual(before.ownerExpenses); expect(saved.syncKey).toBe(before.syncKey);
    expect(res.body[0].state).not.toHaveProperty('syncKey');
  });
  it('rejects stale writes without touching the database', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify([{ state: { ...fixture(), syncRevision: 'other-user' }, updated_at: timestamp }])));
    const res = response(); await cloudHandler(writeRequest(), res);
    expect(res.body).toEqual([]); expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('does not write when the pre-read fails', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('', { status: 503 }));
    const res = response(); await cloudHandler(writeRequest(), res);
    expect(res.statusCode).toBe(502); expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('rejects owner financial modifications from an admin', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: actor('admin') }, error: null });
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify([{ state: fixture(), updated_at: timestamp }])));
    const req = writeRequest(); (req.body.state as any).ownerExpenses = [{ id: 'forged-expense' }];
    const res = response(); await cloudHandler(req, res);
    expect(res.statusCode).toBe(403); expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('rejects deletion of owner records through tombstones', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: actor('admin') }, error: null });
    const before = { ...fixture(), ownerExpenses: [{ id: 'owner-expense' }] } as any;
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify([{ state: before, updated_at: timestamp }])));
    const req = writeRequest(before); req.body.state.deletedIds = ['owner-expense'];
    const res = response(); await cloudHandler(req, res); expect(res.statusCode).toBe(403); expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('forwards client traffic only to its own server without saved keys', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('[]'));
    await cloudFetch('https://attacker.invalid/rest/v1/app_storage?id=eq.main', { method: 'PATCH', headers: { apikey: 'old-key', Authorization: 'Bearer old-key' }, body: JSON.stringify({ state: { ...fixture(), syncKey: 'old-key', dbUrl: 'private' } }) });
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('/api/cloud?id=eq.main');
    expect(new Headers(options?.headers).has('apikey')).toBe(false); expect(new Headers(options?.headers).has('Authorization')).toBe(false);
    expect(String(options?.body)).not.toContain('old-key');
  });
});
