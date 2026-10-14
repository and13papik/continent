import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './api/webhook';
import { getSupabaseClient } from './api/_lib/supabase';

vi.mock('./api/_lib/supabase', () => ({ getSupabaseClient: vi.fn() }));
const secret = 'local-test-webhook-secret';
const stored = new Map<string, any>();
const upsert = vi.fn(async (row: any, options: any) => {
  // Enforce the actual production column and composite unique index.
  if ('delivery_id' in row || options.onConflict !== 'event_type,dedup_key') {
    return { error: { message: 'Schema mismatch' } };
  }
  const key = `${row.event_type}:${row.dedup_key}`;
  if (!stored.has(key)) stored.set(key, row);
  return { error: null };
});
const from = vi.fn(() => ({ upsert }));

function request(type = 'chat.message', delivery = 'delivery-1', valid = true) {
  const body = JSON.stringify({ type, payload: { message: { id: 'message-1', created_at: '2026-10-14T09:00:00Z' } } });
  const timestamp = String(Math.floor(Date.now() / 1000));
  return { method: 'POST', body, headers: {
    'x-om-webhook-id': delivery,
    'x-om-webhook-timestamp': timestamp,
    'x-om-webhook-signature': valid ? createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex') : 'invalid',
  } };
}
async function invoke(req: any) {
  const result: any = { headers: {} };
  const res: any = { status(code: number) { result.status = code; return res; }, json(body: any) { result.body = body; return res; }, setHeader(key: string, value: string) { result.headers[key] = value; } };
  await handler(req, res);
  return result;
}

beforeEach(() => {
  stored.clear();
  vi.stubEnv('WEBHOOK_SECRET', secret);
  vi.mocked(getSupabaseClient).mockResolvedValue({ from } as any);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('OnlyMonster durable event acknowledgement', () => {
  it('stores a signed event using the deployed schema', async () => {
    const result = await invoke(request());
    expect(result.status).toBe(200);
    expect(result.body.saved).toBe(true);
    expect(from).toHaveBeenCalledWith('om_webhook_events');
    expect([...stored.values()][0].webhook_delivery_id).toBe('delivery-1');
  });
  it('acknowledges retries without replacing the original event', async () => {
    await invoke(request());
    const result = await invoke(request('chat.message', 'delivery-retry'));
    expect(result.status).toBe(200);
    expect(stored.size).toBe(1);
    expect([...stored.values()][0].webhook_delivery_id).toBe('delivery-1');
  });
  it('keeps distinct event types with the same delivery key', async () => {
    await invoke(request('custom.created'));
    await invoke(request('custom.updated'));
    expect(stored.size).toBe(2);
  });
  it('returns retryable failure when storage rejects the write', async () => {
    upsert.mockResolvedValueOnce({ error: { message: 'Database unavailable' } });
    const result = await invoke(request());
    expect(result.status).toBe(503);
    expect(result.body.saved).toBe(false);
    expect(result.headers['Retry-After']).toBe('30');
    expect(stored.size).toBe(0);
    expect((await invoke(request())).status).toBe(200);
    expect(stored.size).toBe(1);
  });
  it('does not acknowledge missing database configuration', async () => {
    vi.mocked(getSupabaseClient).mockResolvedValueOnce(null);
    expect((await invoke(request())).status).toBe(503);
    expect(upsert).not.toHaveBeenCalled();
  });
  it('does not acknowledge an exception during persistence', async () => {
    upsert.mockRejectedValueOnce(new Error('Connection interrupted'));
    expect((await invoke(request())).status).toBe(503);
  });
  it('rejects an invalid signature before accessing the database', async () => {
    expect((await invoke(request('chat.message', 'bad', false))).status).toBe(401);
    expect(getSupabaseClient).not.toHaveBeenCalled();
  });
});
