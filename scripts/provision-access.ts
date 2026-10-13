import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { loginIdentity } from '../api/_lib/auth';

// Deliberate, separate activation step. Never runs as part of build, tests, or startup.
async function main() {
  const [mode, inputPath, outputPath] = process.argv.slice(2);
  if (mode !== '--apply' || !inputPath || !outputPath) throw new Error('Usage: tsx scripts/provision-access.ts --apply <private-accounts.json> <private-passwords.json>');
  const output = path.resolve(outputPath), repository = path.resolve('.');
  if (output === repository || output.startsWith(repository + path.sep)) throw new Error('Credential output must be outside the repository');
  try { await access(output); throw new Error('Credential output already exists; refusing to overwrite'); }
  catch (error: any) { if (error.code !== 'ENOENT') throw error; }
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Server Supabase credentials are required');
  const requested: { username: string; role: 'admin' | 'owner' }[] = JSON.parse(await readFile(inputPath, 'utf8'));
  if (!Array.isArray(requested) || requested.length === 0 || requested.some(account => !loginIdentity(account.username) || !['admin', 'owner'].includes(account.role))) throw new Error('Invalid account manifest');
  const emails = requested.map(account => loginIdentity(account.username)!);
  if (new Set(emails).size !== emails.length) throw new Error('Duplicate usernames');
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  for (let page = 1; ; page++) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error('Cannot inspect existing authentication users');
    if (data.users.some(user => emails.includes(user.email || ''))) throw new Error('An account already exists; no passwords were reset');
    if (data.users.length < 1000) break;
  }
  const records = requested.map((account, index) => ({ username: emails[index].split('@')[0], role: account.role, password: randomBytes(18).toString('base64url'), status: 'pending', userId: '' }));
  // Save first so a partial network failure never loses the generated credentials.
  await writeFile(output, JSON.stringify(records, null, 2), { flag: 'wx', mode: 0o600 });
  for (const record of records) {
    const { data, error } = await client.auth.admin.createUser({ email: loginIdentity(record.username)!, password: record.password, email_confirm: true, app_metadata: { continental_role: record.role, continental_username: record.username } });
    if (error || !data.user) throw new Error('Account provisioning stopped. Check the private output before retrying; no existing user was modified.');
    record.status = 'created'; record.userId = data.user.id;
    await writeFile(output, JSON.stringify(records, null, 2), { mode: 0o600 });
  }
  console.log(`Created ${records.length} accounts. Credentials saved only in the private output file. No financial tables were accessed.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
