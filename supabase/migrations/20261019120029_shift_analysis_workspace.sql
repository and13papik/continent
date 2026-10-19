-- Separate analysis storage: no changes to payroll, transactions or closed periods.
create table public.om_shift_analysis_cache (
  id text primary key,
  kind text not null check (kind in ('report', 'ai', 'budget')),
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index om_shift_analysis_cache_created_idx on public.om_shift_analysis_cache (created_at);

create table public.om_shift_experiments (
  id uuid primary key,
  created_by uuid not null,
  updated_by uuid not null,
  operator_id text not null,
  title text not null check (length(title) between 1 and 180),
  hypothesis text not null check (length(hypothesis) between 1 and 2000),
  plan text not null check (length(plan) between 1 and 2000),
  success_metric text not null check (length(success_metric) between 1 and 1000),
  stop_condition text not null check (length(stop_condition) between 1 and 1000),
  source_url text not null default '' check (source_url = '' or source_url ~* '^https?://'),
  source_note text not null default '',
  baseline jsonb not null,
  status text not null default 'planned' check (status in ('planned', 'active', 'completed', 'stopped')),
  outcome text not null default 'pending' check (outcome in ('pending', 'promising', 'no_improvement', 'inconclusive')),
  result text not null default '',
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  check (status <> 'completed' or (outcome <> 'pending' and length(trim(result)) > 0)),
  check (status <> 'stopped' or length(trim(result)) > 0)
);
create index om_shift_experiments_created_idx on public.om_shift_experiments (created_at desc);

create table public.om_shift_experiment_events (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references public.om_shift_experiments(id),
  actor_id uuid not null,
  revision integer not null,
  previous_status text,
  status text not null,
  outcome text not null,
  result text not null,
  created_at timestamptz not null default now(),
  unique (experiment_id, revision)
);
create function public.record_shift_experiment_event() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.om_shift_experiment_events
    (experiment_id, actor_id, revision, previous_status, status, outcome, result)
  values (new.id, new.updated_by, new.revision,
    case when tg_op = 'UPDATE' then old.status else null end,
    new.status, new.outcome, new.result);
  return new;
end;
$$;
revoke all on function public.record_shift_experiment_event() from public, anon, authenticated;
grant execute on function public.record_shift_experiment_event() to service_role;
create trigger shift_experiment_event after insert or update on public.om_shift_experiments
for each row execute function public.record_shift_experiment_event();

alter table public.om_shift_analysis_cache enable row level security;
alter table public.om_shift_experiments enable row level security;
alter table public.om_shift_experiment_events enable row level security;
revoke all on public.om_shift_analysis_cache, public.om_shift_experiments, public.om_shift_experiment_events from public, anon, authenticated;
grant select, insert, update, delete on public.om_shift_analysis_cache to service_role;
grant select, insert, update on public.om_shift_experiments to service_role;
grant select, insert on public.om_shift_experiment_events to service_role;
