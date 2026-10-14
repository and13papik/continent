-- Append-only financial history, outside the synchronised application state.
CREATE TABLE public.app_audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  actor_id text,
  actor_username text NOT NULL,
  actor_role text NOT NULL CHECK (actor_role IN ('owner', 'admin', 'system')),
  revision text,
  collection text NOT NULL,
  record_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('create', 'update', 'delete', 'enabled')),
  period_id text,
  label text NOT NULL,
  before_value jsonb,
  after_value jsonb
);
ALTER TABLE public.app_audit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_audit_events FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON public.app_audit_events TO service_role;
REVOKE ALL ON SEQUENCE public.app_audit_events_id_seq FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SEQUENCE public.app_audit_events_id_seq TO service_role;
CREATE INDEX app_audit_events_collection_id ON public.app_audit_events(collection, id DESC);

CREATE FUNCTION public.continental_financial_changes(previous jsonb, following jsonb)
RETURNS TABLE(collection text, record_id text, before_value jsonb, after_value jsonb)
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  field_name text;
  b jsonb;
  a jsonb;
  keyed boolean;
BEGIN
  -- Explicit allowlist excludes credentials, documents and sync-only metadata.
  FOREACH field_name IN ARRAY ARRAY[
    'incomeData','operationsData','ownerExpenses','ownerManualIncomes','ownerAdvances',
    'modelBonuses','paidStatuses','advanceRequests','totalTableEntries','accountingPeriods',
    'admins','operatorWallets','rosterData','operators','models','modelGroups',
    'priorityModels','inactiveModels','modelRates','modelDefaultGoals','modelMonthlyPlans'
  ] LOOP
    b := previous -> field_name; a := following -> field_name;
    IF b IS NOT DISTINCT FROM a THEN CONTINUE; END IF;
    keyed := field_name = ANY(ARRAY[
      'incomeData','operationsData','ownerExpenses','ownerManualIncomes','ownerAdvances',
      'modelBonuses','paidStatuses','advanceRequests','totalTableEntries','accountingPeriods',
      'admins','operatorWallets','rosterData','modelGroups'
    ]);
    IF keyed THEN
      b := coalesce(nullif(b, 'null'::jsonb), '[]'::jsonb);
      a := coalesce(nullif(a, 'null'::jsonb), '[]'::jsonb);
      keyed := jsonb_typeof(b) = 'array' AND jsonb_typeof(a) = 'array';
      IF keyed THEN
        -- Unexpected legacy IDs fall back to one complete collection change.
        keyed := (SELECT count(*) = count(DISTINCT value->>'id') FROM jsonb_array_elements(b))
             AND (SELECT count(*) = count(DISTINCT value->>'id') FROM jsonb_array_elements(a));
      END IF;
    END IF;
    IF keyed THEN
      RETURN QUERY
        SELECT field_name, coalesce(o.value->>'id', n.value->>'id'), o.value, n.value
        FROM jsonb_array_elements(b) o
        FULL JOIN jsonb_array_elements(a) n ON o.value->>'id' = n.value->>'id'
        WHERE (o.value - 'updatedAt' - 'createdAt') IS DISTINCT FROM (n.value - 'updatedAt' - 'createdAt');
    ELSIF b IS DISTINCT FROM a THEN
      RETURN QUERY SELECT field_name, '$', b, a;
    END IF;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.continental_financial_changes(jsonb,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.continental_financial_changes(jsonb,jsonb) TO service_role;

CREATE FUNCTION public.continental_record_financial_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  request_headers jsonb := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  actor_id text;
  actor_username text := 'system';
  actor_role text := 'system';
BEGIN
  -- app_storage is server-only. Only the verified API supplies these headers;
  -- request body fields and client-supplied headers are never forwarded.
  IF current_user = 'service_role'
     AND request_headers->>'x-continental-actor-role' IN ('owner','admin')
     AND nullif(request_headers->>'x-continental-actor-id', '') IS NOT NULL THEN
    actor_id := left(request_headers->>'x-continental-actor-id', 200);
    actor_username := left(coalesce(nullif(request_headers->>'x-continental-actor-name', ''), 'unknown'), 64);
    actor_role := request_headers->>'x-continental-actor-role';
  END IF;
  INSERT INTO public.app_audit_events
    (actor_id, actor_username, actor_role, revision, collection, record_id, action, period_id, label, before_value, after_value)
  SELECT actor_id, actor_username, actor_role, NEW.state->>'syncRevision',
    d.collection, d.record_id,
    CASE WHEN d.before_value IS NULL THEN 'create' WHEN d.after_value IS NULL THEN 'delete' ELSE 'update' END,
    CASE WHEN d.collection = 'accountingPeriods' THEN d.record_id ELSE coalesce(d.after_value->>'periodId', d.before_value->>'periodId') END,
    left(coalesce(nullif(concat_ws(' · ',
      coalesce(d.after_value->>'operator', d.before_value->>'operator', d.after_value->>'ownerName', d.before_value->>'ownerName'),
      coalesce(d.after_value->>'model', d.before_value->>'model', d.after_value->>'modelName', d.before_value->>'modelName', d.after_value->>'name', d.before_value->>'name', d.after_value->>'label', d.before_value->>'label', d.after_value->>'entityName', d.before_value->>'entityName'),
      coalesce(d.after_value->>'date', d.before_value->>'date')
    ), ''), d.record_id), 500), d.before_value, d.after_value
  FROM public.continental_financial_changes(OLD.state, NEW.state) d;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.continental_record_financial_audit() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.continental_record_financial_audit() TO service_role;

CREATE TRIGGER continental_financial_audit
AFTER UPDATE OF state ON public.app_storage FOR EACH ROW
WHEN (OLD.id = 'main' AND OLD.state IS DISTINCT FROM NEW.state)
EXECUTE FUNCTION public.continental_record_financial_audit();

INSERT INTO public.app_audit_events(actor_username,actor_role,collection,record_id,action,label)
VALUES ('system','system','system','audit-enabled','enabled','История действий включена');
