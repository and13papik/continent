# Access hardening — activation checklist

This branch is not a drop-in deployment until the activation checks below are complete. Financial records and database permissions remain unchanged. The three requested Auth accounts and the additional production server variables have been provisioned; the application itself has not been published.

## Verified preparation, 2026-10-13

- Created one shared owner account and two admin accounts with confirmed internal identities. Generated passwords are in a private local file outside Git.
- Verified all three credentials through the actual Auth handler and Supabase Auth in a local browser, including four concurrent sessions, refresh, logout isolation between owners, rejection of a wrong password, and owner-only API denial for admins.
- The verification server permitted only financial reads. It performed zero financial writes; the main row digest and all 52 snapshot rows remained unchanged. External notifications were blocked.
- Added production `APP_ORIGIN`, `SUPABASE_PUBLISHABLE_KEY`, `TELEGRAM_BOT_TOKEN`, and `TELEGRAM_CHAT_ID` in Vercel. Existing Supabase/OnlyMonster/webhook variables were preserved. None of these changes redeploys the site automatically.
- Telegram uses its existing bot credential to preserve current reports. Previously exposed Telegram and OnlyMonster credentials have **not been rotated**; moving them to server settings does not invalidate old copies. Coordinate rotation separately and verify the replacement credentials before switching them.
- Live production integration checks, deployment, and the prepared database-access migration are still pending release approval. Current production continues to use the previous login and database permissions.

## User-facing login

Username and password only. A leading `@` and letter case are ignored. Supabase Auth manages password hashes and sessions internally, using confirmed synthetic addresses under `accounts.continental.invalid`; no emails or Telegram confirmations are sent.

Approved account manifest (keep the real manifest and generated passwords outside the repository): one shared owner account and two individual admin accounts. Roles live in trusted Supabase `app_metadata.continental_role`, never editable `user_metadata` or browser storage. Two owners may use the same account concurrently.

## Configuration before activation

1. Set `APP_ORIGIN` to the exact HTTPS origin for each deployment. Use a separate test Supabase project for a preview. Local development uses `http://localhost:3000`. Never put private keys in `VITE_*` variables.
2. Configure `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (or `SUPABASE_ANON_KEY`) and `SUPABASE_SERVICE_ROLE_KEY` on the server. The database key must retain access to the existing `app_storage` row; this change creates no business tables and performs no data migration.
3. Configure `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, optional comma-separated `TELEGRAM_ALLOWED_CHAT_IDS`, and the existing OnlyMonster settings. Rotate the bot token previously present in the public repository, and rotate the exposed OnlyMonster token. Review and revoke any privileged database key previously distributed to browsers. Configure replacement values before activating the new code. Removing literals does not revoke old keys or erase Git history.
4. Provision the requested accounts through `scripts/provision-access.ts --apply <private manifest> <private output>`, with server credentials in the process environment. It refuses existing usernames and never resets an existing user's password. It only creates Auth users, with no mail delivery or financial writes. Do not run it through the Vite application.
5. Verify actual passwords and sessions on the protected preview, including both owners concurrently. Test a report using a dedicated test Telegram chat only after the user explicitly requests that send. Automated tests mock all external services.

## Database boundary is mandatory

The new browser uses `/api/cloud` and receives no database secret. This alone does not revoke direct access through an old key or permissive Supabase policies. Before calling the deployment secure, inspect grants and RLS on the existing tables and block anonymous/direct authenticated access to `app_storage` and integration event tables. Keep server service-role access intact. Do not run speculative RLS or grant changes without inspecting the actual schema and existing integrations first.

Read-only production audit on 2026-10-13 confirmed 20 public tables and three accounting views with direct `anon` and `authenticated` privileges. RLS is disabled on 19 tables; only `om_webhook_events` has RLS enabled. No RLS policies, public routines, or foreign tables were found. Auth currently has zero users. The browser's stored database key is a publishable key, so revoking direct table privileges is essential even after adding login.

`security/activate-database-boundary.sql` is a prepared manual release step, **not applied**. It refuses a changed public schema, revokes direct privileges on the audited tables/views, enables table RLS, and asserts that server access and `app_storage` contents remain intact. Apply through Supabase `apply_migration` only after credentials and logins work and existing integrations are confirmed to use server credentials. It does not provision users or alter financial rows. Database permissions for future tables still need explicit review.

The existing main JSON document is shared with authenticated staff. Owner documents and finances are protected against admin writes, including tombstone deletion, but this change does **not** partition the shared JSON into confidential per-role read views. Hiding a navigation item is not a confidentiality boundary. Existing browser backups also remain on their devices to preserve unsynced work.

## Safe release sequence

1. Export the latest main row and history; make sure all active users' pending changes have synced.
2. Validate server configuration and account access in preview. Do not point a preview at production data for write tests.
3. Obtain approval for the reviewed release, then publish the application. Coordinate direct-database access revocation and key rotation with that release; old clients will require refresh and login.
4. Compare business fields with the pre-release snapshot. Verify that unauthenticated API calls return 401, admin configuration writes return 403, old direct database access is denied, and all three logins work.
5. Retain the snapshots. A rollback to the old client requires a deliberate access decision; do not automatically restore exposed credentials or open database grants.

## Implementation notes

- Access/refresh cookies are HttpOnly, Secure and SameSite=Strict. State-changing API calls also require the configured same origin.
- Each API request validates the session with Supabase `getUser`; missing configuration and verification failures deny access. There is no fallback to the old shared passwords.
- Cloud writes preserve the existing compare-and-swap timestamp/revision filters and unknown fields. Failed reads, stale revisions, invalid main rows and unauthorized owner changes never proceed to a write.
- OnlyMonster config returns flags, not active tokens. Writes require owner access. Cleanup requires an owner session and POST, with no default cron password.
- Telegram forwarding permits only three methods and configured chat destinations. Token-bearing upstream errors are not returned to the browser. A failed/ambiguous send should be checked in Telegram before a manual retry.
- Background Telegram polling/scheduling and live-event deletion on the persistent Express server require explicit environment flags. Vercel functions do not run these background loops.

References: [Supabase getUser](https://supabase.com/docs/reference/javascript/auth-getuser), [password authentication](https://supabase.com/docs/reference/javascript/auth-signinwithpassword).
