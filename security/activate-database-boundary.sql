-- MANUAL RELEASE STEP ONLY. Do not apply before the new server, credentials,
-- and all three account logins have been verified. Existing clients use direct
-- database access and must refresh after this coordinated switch.
-- Audited project: uncmllzfygxclndaevia, 2026-10-13.
-- Run through Supabase apply_migration inside its migration transaction.
-- No business rows are inserted, updated, deleted, or moved.

DO $boundary$
DECLARE
  expected_tables text[] := ARRAY[
    'accounting_periods', 'admin_period_rates', 'admins', 'agency_transactions',
    'app_storage', 'financial_operations', 'income_records', 'model_monthly_plans',
    'model_period_bonuses', 'model_period_rates', 'models', 'om_webhook_events',
    'operators', 'owner_draws', 'owner_period_shares', 'owners',
    'payout_settlement_flags', 'roster_shift_models', 'roster_shifts',
    'shift_balance_entries'
  ];
  expected_views text[] := ARRAY[
    'v_model_period_accounting', 'v_operator_period_accounting', 'v_period_agency_pnl'
  ];
  actual_tables text[];
  actual_views text[];
  relation_name text;
  before_digest text;
  after_digest text;
BEGIN
  SELECT array_agg(c.relname::text ORDER BY c.relname) INTO actual_tables
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p');
  SELECT array_agg(c.relname::text ORDER BY c.relname) INTO actual_views
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'v';
  IF actual_tables IS DISTINCT FROM expected_tables
     OR actual_views IS DISTINCT FROM expected_views THEN
    RAISE EXCEPTION 'Public schema changed since audit; review before activation';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
  ) OR EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('f', 'm')
  ) THEN
    RAISE EXCEPTION 'Additional API exposure requires review before activation';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role' AND rolbypassrls) THEN
    RAISE EXCEPTION 'Server service_role must retain RLS bypass';
  END IF;

  -- Hold financial snapshots stable while permissions change and verify their
  -- contents without exporting sensitive data or writing a backup into the DB.
  LOCK TABLE public.app_storage IN SHARE MODE;
  SELECT md5(string_agg(md5(to_jsonb(s)::text), '' ORDER BY s.id))
    INTO before_digest FROM public.app_storage s;

  FOREACH relation_name IN ARRAY expected_tables || expected_views LOOP
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC, anon, authenticated', relation_name);
    IF has_table_privilege('anon', format('public.%I', relation_name), 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
       OR has_table_privilege('authenticated', format('public.%I', relation_name), 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER') THEN
      RAISE EXCEPTION 'Inherited direct privileges remain for %', relation_name;
    END IF;
    IF NOT has_table_privilege('service_role', format('public.%I', relation_name), 'SELECT') THEN
      RAISE EXCEPTION 'Server read access missing for %', relation_name;
    END IF;
  END LOOP;
  FOREACH relation_name IN ARRAY expected_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', relation_name);
    IF NOT has_table_privilege('service_role', format('public.%I', relation_name), 'INSERT')
       OR NOT has_table_privilege('service_role', format('public.%I', relation_name), 'UPDATE')
       OR NOT has_table_privilege('service_role', format('public.%I', relation_name), 'DELETE') THEN
      RAISE EXCEPTION 'Server write access missing for %', relation_name;
    END IF;
  END LOOP;

  SELECT md5(string_agg(md5(to_jsonb(s)::text), '' ORDER BY s.id))
    INTO after_digest FROM public.app_storage s;
  IF before_digest IS DISTINCT FROM after_digest THEN
    RAISE EXCEPTION 'Snapshot contents changed during permission update';
  END IF;
END;
$boundary$;
