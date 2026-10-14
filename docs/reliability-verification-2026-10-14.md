# Reliability verification — 2026-10-14

## Changes

- Build Tailwind CSS with PostCSS instead of loading and running the CDN compiler in every browser. Keep existing layout, colors, typography and animation code. Explicit compatibility selectors preserve the previous cascade of conflicting utilities; safelist derived financial-card colors.
- Add a database trigger that captures the previous `main` state before the first changed save in each UTC hour, atomically with that save. Repeated writes in an hour preserve the first snapshot. Unchanged saves create no snapshot. Insert an activation baseline without modifying existing rows.
- Snapshots remain in `app_storage`, protected by its existing server-only access, and are compatible with the existing owner recovery interface. This is change-triggered protection, not a scheduled backup or a separate storage service. There is no automatic pruning; storage usage needs ongoing review.

## Verification

- 124 existing tests passed; TypeScript check and Vite production build passed.
- Four isolated browser sessions against a local simulated CAS backend: simultaneous additions, offline edit/reload/reconnect, lost server response/retry, and all-session reload. Seven synthetic additions, three CAS retries, no missing or duplicate additions; original operations and private owner fields preserved. No production financial writes.
- Local copy of live data: 16 financial-page checks for July–October passed. Dashboard, model and reporting calculations agreed for the checked totals; this does not certify underlying bookkeeping entries.
- Before/after computed-style comparison on 12 routes at desktop and mobile widths: zero differences in checked properties. Disable transitions only in the comparison harness to avoid sampling different animation phases; production animations stay enabled. Dashboard screenshots inspected.
- Removed a 407,279-byte uncompressed CDN compiler request; generated CSS is approximately 21.7 KB gzip. This is an asset/work reduction, not an end-to-end latency guarantee.
- All 52 downloaded backup files passed SHA-256 and JSON structure verification. They are kept outside the repository and deployment artifacts.
- Trigger tested on a temporary table within a rolled-back transaction: exact baseline, first-state preservation, hourly deduplication, unchanged-save behavior, full-state restore, and atomic rollback on error.
- After migration: trigger active, activation baseline matches live state, and live state checksum/timestamp unchanged. No financial records edited by the migration.
- Authenticated production reads for owner and two admin accounts passed before release: current revision, no sync conflict, private owner data redacted for admins, and metadata response below 1 KB. Release verification is recorded separately outside the repository.

## Operational boundaries

Keep backup files and credentials private. For recovery, compare the intended historical version first and preserve the current state before applying the existing full-system restore operation. The live system was not rolled back as a test. Historical records detached from deleted periods remain preserved; reassignment requires a bookkeeping decision.

Supabase security checks reported no new migration warnings. Existing no-policy RLS notices reflect server-only access; enabling browser access is not part of this change. The existing leaked-password protection notice requires a separate Auth configuration decision.

## Follow-up: OnlyMonster event persistence

Release log inspection revealed an existing contract mismatch: the webhook wrote `delivery_id` and targeted a single-column conflict key, while the deployed table has `webhook_delivery_id` and a unique `(event_type, dedup_key)` index. Align the handler to that schema without altering database rows or accounting calculations. A failed persistence attempt now returns 503 with `Retry-After` instead of acknowledging success; duplicate delivery remains a successful no-op.

Seven additional signed-request tests cover storage, duplicate and cross-type delivery, database failure/retry, missing configuration, thrown errors, and invalid signatures. All 131 tests and TypeScript pass. The actual table's constraints/indexes were copied to a temporary table and its duplicate-delivery behavior verified inside a rolled-back transaction. Historical events acknowledged by the previous handler but never saved cannot be reconstructed by this code fix.
