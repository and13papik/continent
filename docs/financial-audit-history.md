# Financial audit history

Owners can open **Settings → История действий**. The list is fetched only when opened, in pages of 50 metadata records; before/after values load on demand. Filtering by section and action is server-side. IDs remain strings to preserve bigint cursor precision. No edit/delete controls or history mutation API exist.

The authenticated cloud API sets saver identity headers from the verified Supabase user. Client headers, body claims and editable user metadata do not determine attribution. The shared owner login identifies an account, not the individual person using it. Offline/recovered edits are attributed to the account that successfully saves the merged changes, at server commit time.

An AFTER UPDATE trigger computes changes from the actual previous/new `app_storage.main` state. It inserts audit events in the same transaction as the existing conditional save and hourly snapshot trigger. Failed CAS writes, identical retries, array reordering and row timestamp-only changes do not create financial events. Failed transactions roll back their audit events. Snapshot rows are ignored. Restores are recorded as the resulting additions, edits and deletions.

The explicit allowlist covers income, operations/payments, owner income/expenses/advances, model bonuses, payment flags, advance requests, Total Table, periods, admin rates, operator payment details, roster and financial reference/settings fields. Credentials, sync bookkeeping, notes, documents and task contents are excluded. Before/after values are stored as data and rendered as escaped text. Existing data and old snapshots are not rewritten or backfilled.

`app_audit_events` is server-only with RLS enabled and no browser grants. The service role receives SELECT/INSERT and sequence USAGE, but no UPDATE/DELETE/TRUNCATE. Database administrators still have administrative access; this is an application audit trail, not a tamper-proof external ledger. Server/database updates without verified account headers are labelled system. Old deployments remain compatible but log their writes as system until the API update is live.

## Validation

- 148 tests, TypeScript and production build pass, including forged saver headers, admin denial, pagination above JavaScript's safe integer range, private detail reads, input validation and data/error rendering.
- `scripts/audit-history-checks.sql` ran against temporary copies of the migration objects, with the service role, then rolled back: create/edit/delete, actor changes, CAS failure, duplicate/no-op suppression, nested edits, malformed legacy ID fallback, transaction rollback, snapshot exclusion and table privileges.
- Browser checks used synthetic audit events and a local copy of app data. No production financial writes: owner-only UI, on-demand requests, before/after values, pagination, filter reset, errors/retry, escaped markup and constrained-width layout passed.
- A read-only comparison of current production-sized state took approximately 147 ms on the database at verification time. The history is not loaded during normal dashboard use or sync polling.
- Fresh backup of all 55 existing app-storage rows passed checksum verification before migration. Main-state checksum was unchanged after activation.

History starts at the activation record; earlier changes/authors cannot be reconstructed. No automatic history pruning is enabled. Review database growth before choosing a retention policy; deleting historical audit data is not part of this feature. To disable recording in an emergency, disable only `continental_financial_audit`; retain its table and the independent hourly backup trigger.
