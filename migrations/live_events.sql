-- Migration: Create live_events table for 24-hour financial milestone notifications
-- Supports deduplication, automatic expiration, and high-performance querying

CREATE TABLE IF NOT EXISTS live_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'account_shift_revenue_milestone',
  category TEXT NOT NULL DEFAULT 'finance',
  account_id TEXT,
  account_name TEXT,
  shift_id TEXT NOT NULL,
  milestone NUMERIC NOT NULL,
  amount NUMERIC,
  currency TEXT DEFAULT 'USD',
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours')
);

-- Unique index to prevent duplicate events for the same account, shift, and milestone
CREATE UNIQUE INDEX IF NOT EXISTS live_events_dedupe_key_uidx
ON live_events (dedupe_key);

-- Index for TTL queries: WHERE expires_at > now()
CREATE INDEX IF NOT EXISTS live_events_expires_at_idx
ON live_events (expires_at);

-- Index for event_type and shift_id filtering
CREATE INDEX IF NOT EXISTS live_events_event_type_idx
ON live_events (event_type);

CREATE INDEX IF NOT EXISTS live_events_shift_id_idx
ON live_events (shift_id);

-- Optional: If using Supabase pg_cron for automatic cleanup every hour:
-- SELECT cron.schedule(
--   'cleanup-expired-live-events',
--   '0 * * * *',
--   $$DELETE FROM live_events WHERE expires_at <= now()$$
-- );
