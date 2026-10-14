-- Run after installing the migration into temporary tables/functions and
-- seeding audit_storage(main). The surrounding transaction must ROLLBACK.
SET LOCAL ROLE service_role;
SELECT set_config('request.headers', '{"x-continental-actor-id":"verified-admin","x-continental-actor-name":"admin_test","x-continental-actor-role":"admin"}', true);
UPDATE pg_temp.audit_storage SET state = '{"syncRevision":"rev-1","incomeData":[{"id":"income-1","operator":"Test","periodId":"period-1","total":100}],"syncKey":"never-log-this"}' WHERE id='main';
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_temp.audit_events WHERE action='create' AND actor_id='verified-admin' AND actor_username='admin_test' AND actor_role='admin' AND after_value->>'total'='100') THEN RAISE EXCEPTION 'Missing verified actor/create event'; END IF;
  IF EXISTS(SELECT 1 FROM pg_temp.audit_events WHERE collection='syncKey' OR before_value::text LIKE '%never-log-this%' OR after_value::text LIKE '%never-log-this%') THEN RAISE EXCEPTION 'Credential leaked'; END IF;
END $$;
UPDATE pg_temp.audit_storage SET state=jsonb_set(jsonb_set(state,'{incomeData,0,total}','125'),'{syncRevision}','"rev-2"') WHERE id='main';
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_temp.audit_events WHERE action='update' AND before_value->>'total'='100' AND after_value->>'total'='125') THEN RAISE EXCEPTION 'Missing before/after'; END IF;
END $$;
-- A lost CAS race never updates the row or produces an audit event.
UPDATE pg_temp.audit_storage SET state=jsonb_set(state,'{incomeData,0,total}','999') WHERE id='main' AND state->>'syncRevision'='rev-1';
-- Sync-only changes and identical retries produce no financial audit entries.
UPDATE pg_temp.audit_storage SET state=jsonb_set(state,'{lastUpdated}','123456') WHERE id='main';
UPDATE pg_temp.audit_storage SET state=state WHERE id='main';
DO $$ BEGIN IF (SELECT count(*) FROM pg_temp.audit_events) <> 3 THEN RAISE EXCEPTION 'No-op/race was logged'; END IF; END $$;
-- A database failure must roll back both data and its audit event.
DO $$ BEGIN
  BEGIN
    UPDATE pg_temp.audit_storage SET state=jsonb_set(state,'{incomeData,0,total}','666') WHERE id='main';
    RAISE EXCEPTION 'simulate failed transaction';
  EXCEPTION WHEN raise_exception THEN NULL; END;
  IF (SELECT state#>>'{incomeData,0,total}' FROM pg_temp.audit_storage WHERE id='main') <> '125' OR (SELECT count(*) FROM pg_temp.audit_events) <> 3 THEN RAISE EXCEPTION 'Atomic rollback failed'; END IF;
END $$;
SELECT set_config('request.headers', '{"x-continental-actor-id":"verified-owner","x-continental-actor-name":"owner_test","x-continental-actor-role":"owner"}', true);
UPDATE pg_temp.audit_storage SET state=jsonb_set(state,'{incomeData}','[]') WHERE id='main';
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_temp.audit_events WHERE action='delete' AND actor_username='owner_test' AND before_value->>'total'='125' AND after_value IS NULL) THEN RAISE EXCEPTION 'Missing deletion'; END IF;
  IF has_table_privilege('service_role','pg_temp.audit_events','UPDATE') OR has_table_privilege('service_role','pg_temp.audit_events','DELETE') THEN RAISE EXCEPTION 'History is mutable through server role'; END IF;
  IF has_table_privilege('authenticated','pg_temp.audit_events','SELECT') OR has_table_privilege('anon','pg_temp.audit_events','SELECT') THEN RAISE EXCEPTION 'History publicly readable'; END IF;
END $$;
UPDATE pg_temp.audit_storage SET state='{"incomeData":[{"id":"snapshot-only","total":9}]}' WHERE id='snapshot';
DO $$ BEGIN IF (SELECT count(*) FROM pg_temp.audit_events) <> 4 THEN RAISE EXCEPTION 'Snapshot was logged'; END IF; END $$;
RESET ROLE;
SELECT set_config('request.headers', '', true);
UPDATE pg_temp.audit_storage SET state=jsonb_set(state,'{incomeData}','[{"id":"server","total":10}]') WHERE id='main';
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_temp.audit_events WHERE record_id='server' AND actor_role='system') THEN RAISE EXCEPTION 'Server write misattributed'; END IF;
  IF EXISTS(SELECT 1 FROM pg_temp.continental_financial_changes('{"incomeData":[{"id":"a","total":1},{"id":"b","total":2}]}','{"incomeData":[{"id":"b","total":2},{"id":"a","total":1}]}')) THEN RAISE EXCEPTION 'Reordering logged as a change'; END IF;
  IF EXISTS(SELECT 1 FROM pg_temp.continental_financial_changes('{"incomeData":[{"id":"a","total":1,"updatedAt":"old"}]}','{"incomeData":[{"id":"a","total":1,"updatedAt":"new"}]}')) THEN RAISE EXCEPTION 'Timestamp-only change logged'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_temp.continental_financial_changes('{"totalTableEntries":[{"id":"t","night":{"balance":1}}]}','{"totalTableEntries":[{"id":"t","night":{"balance":2}}]}') WHERE before_value#>>'{night,balance}'='1' AND after_value#>>'{night,balance}'='2') THEN RAISE EXCEPTION 'Nested change lost'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_temp.continental_financial_changes('{"incomeData":[{"total":1}]}','{"incomeData":[{"total":2}]}') WHERE record_id='$') THEN RAISE EXCEPTION 'Legacy fallback failed'; END IF;
END $$;
