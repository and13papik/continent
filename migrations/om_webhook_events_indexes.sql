-- ============================================================================
-- RECOMMENDED INDEXES AND MAINTENANCE STRATEGY FOR public.om_webhook_events
--
-- TARGET ISSUES:
-- 1. High CPU / Disk IO in Supabase
-- 2. Statement timeout errors (PostgreSQL code 57014) on sequential table scans
-- 3. High latency on GET app_storage and polling om_webhook_events
-- 4. Failures on bulk DELETE operations without index coverage
--
-- CRITICAL SAFETY RULES:
-- - DO NOT APPLY AUTOMATICALLY!
-- - Never run during peak business hours.
-- - Before executing any DDL or data changes, ensure a verified full backup 
--   has been taken in the Supabase Dashboard (Database -> Backups).
-- - Review in the Supabase SQL Editor and execute using CREATE INDEX CONCURRENTLY
--   if your Supabase environment supports it outside of transactions.
-- ============================================================================

-- 1. Primary incremental cursor index
-- Used by: WHERE id > after_id ORDER BY id ASC LIMIT 50
-- Resolves: sequential scans during RealtimeEventFeed periodic polling
CREATE INDEX IF NOT EXISTS idx_om_webhook_events_id_asc 
ON public.om_webhook_events (id ASC);

-- 2. Chronological order index
-- Used by: ORDER BY received_at DESC LIMIT 50
-- Resolves: high Disk IO when fetching initial watermark and webhook diagnostic logs
CREATE INDEX IF NOT EXISTS idx_om_webhook_events_received_at_desc 
ON public.om_webhook_events (received_at DESC);

-- 3. Shift boundary composite index
-- Used by: WHERE received_at >= shiftStart AND received_at <= shiftEnd ORDER BY id ASC / received_at DESC
CREATE INDEX IF NOT EXISTS idx_om_webhook_events_shift_window 
ON public.om_webhook_events (received_at DESC, id ASC);

-- 4. Unique idempotent deduplication index
-- Used by: INSERT ... ON CONFLICT (dedup_key) DO NOTHING in api/webhook.ts
-- Resolves: duplicate webhook inserts and lock contention
CREATE UNIQUE INDEX IF NOT EXISTS idx_om_webhook_events_dedup_key 
ON public.om_webhook_events (dedup_key);

-- 5. Indexes for account filtering
CREATE INDEX IF NOT EXISTS idx_om_webhook_events_account_id 
ON public.om_webhook_events (account_id);

CREATE INDEX IF NOT EXISTS idx_om_webhook_events_platform_account_id 
ON public.om_webhook_events (platform_account_id);

-- 6. Partial index for chat message diagnostic queries
CREATE INDEX IF NOT EXISTS idx_om_webhook_events_chat_messages 
ON public.om_webhook_events (received_at DESC) 
WHERE event_type = 'chat.message';

-- 7. Revenue event filter composite index
-- Used by: financial milestone evaluation (tips, ppv, purchases)
CREATE INDEX IF NOT EXISTS idx_om_webhook_events_financial_types
ON public.om_webhook_events (event_type, received_at DESC)
WHERE event_type IN (
  'fans.tip.received',
  'fans.ppv.purchased',
  'fans.message.purchased',
  'fans.post.purchased',
  'payment.received'
);

-- ============================================================================
-- HISTORICAL DATA MAINTENANCE RECOMMENDATIONS (DO NOT RUN BULK DELETE!)
--
-- Why DELETE was causing statement timeouts (57014):
-- Running `DELETE FROM om_webhook_events WHERE received_at < cutoff` inside
-- an active webhook handler locks table rows, causes full sequential scans if
-- unindexed, and exhausts Supabase connection pool / statement timeout limits.
--
-- Recommended Safe Strategy:
-- 1. Historical financial verification: Keep webhook events intact because
--    historical shift revenue milestones and webhook audit trails may reference
--    past event IDs.
-- 2. If table size exceeds multi-gigabyte thresholds in the future:
--    a) Export cold history to object storage (e.g., Supabase Storage or S3).
--    b) Use PostgreSQL table partitioning by month (`PARTITION BY RANGE (received_at)`),
--       which allows dropping old partitions instantly with zero Disk IO / locking,
--       instead of issuing slow DELETE queries.
-- ============================================================================
