-- Capture the state before the first changed save of each UTC hour.
-- Same transaction as the update: a failed save cannot leave a misleading snapshot.
-- Existing snapshots and the live main row are never rewritten by this migration.
CREATE OR REPLACE FUNCTION public.continental_snapshot_before_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  snapshot_id text;
BEGIN
  IF TG_OP <> 'UPDATE' OR OLD.id <> 'main' OR OLD.state IS NOT DISTINCT FROM NEW.state THEN
    RETURN NEW;
  END IF;
  snapshot_id := 'auto_snapshot_' || pg_catalog.to_char(pg_catalog.clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD_HH24');
  -- Use the triggering relation so the identical function can be verified with a
  -- temporary table. Identifiers are quoted; values are bound, never interpolated.
  EXECUTE pg_catalog.format(
    'INSERT INTO %I.%I (id,state,updated_at) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING',
    TG_TABLE_SCHEMA, TG_TABLE_NAME
  ) USING snapshot_id, OLD.state, OLD.updated_at;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.continental_snapshot_before_update() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.continental_snapshot_before_update() TO service_role;

CREATE TRIGGER continental_hourly_snapshot
BEFORE UPDATE OF state ON public.app_storage
FOR EACH ROW
WHEN (OLD.id = 'main' AND OLD.state IS DISTINCT FROM NEW.state)
EXECUTE FUNCTION public.continental_snapshot_before_update();

-- One named baseline at activation. No update, delete, or retention pruning.
INSERT INTO public.app_storage (id,state,updated_at)
SELECT 'safety_baseline_2026_10_14',state,updated_at FROM public.app_storage WHERE id='main'
ON CONFLICT (id) DO NOTHING;
