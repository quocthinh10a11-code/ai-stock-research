-- Phase F: source cache, input-hash report reuse, cross-instance run locks, and quota telemetry.

alter table public.ai_research_reports
  add column if not exists input_hash text,
  add column if not exists source_ids_json jsonb not null default '[]'::jsonb;

alter table public.ai_research_reports
  add constraint ai_research_input_hash_check check (input_hash is null or input_hash ~ '^[a-f0-9]{64}$'),
  add constraint ai_research_source_ids_array check (jsonb_typeof(source_ids_json) = 'array');

create unique index ai_research_reports_symbol_input_hash_key
  on public.ai_research_reports (symbol, input_hash);

alter table public.sector_ai_briefs
  add column if not exists input_hash text;

alter table public.sector_ai_briefs
  add constraint sector_ai_input_hash_check check (input_hash is null or input_hash ~ '^[a-f0-9]{64}$');

create table public.web_source_cache (
  cache_key text primary key,
  sources_json jsonb not null default '[]'::jsonb,
  content_hash text not null,
  fetched_at timestamptz not null,
  expires_at timestamptz not null,
  source_name text not null default 'tavily',
  last_error text,
  updated_at timestamptz not null default now(),
  constraint web_source_cache_sources_array check (jsonb_typeof(sources_json) = 'array'),
  constraint web_source_cache_hash_check check (content_hash ~ '^[a-f0-9]{64}$'),
  constraint web_source_cache_expiry_check check (expires_at > fetched_at)
);

create table public.research_runs (
  id bigint generated always as identity primary key,
  run_type text not null check (run_type in ('stock', 'sector')),
  cache_key text not null,
  input_hash text not null check (input_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  owner_token uuid not null default gen_random_uuid(),
  requested_by uuid references auth.users(id) on delete set null,
  locked_until timestamptz not null default now() + interval '2 minutes',
  completed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index research_runs_active_input_key
  on public.research_runs (run_type, cache_key, input_hash)
  where status = 'running';

create index research_runs_cleanup_idx on public.research_runs (status, updated_at);

alter table public.web_source_cache enable row level security;
alter table public.research_runs enable row level security;
revoke all on table public.web_source_cache, public.research_runs from anon, authenticated;
grant select, insert, update, delete on table public.web_source_cache, public.research_runs to service_role;
grant usage, select on sequence public.research_runs_id_seq to service_role;

alter table public.ai_research_daily_usage
  add column if not exists stock_request_count integer not null default 0 check (stock_request_count >= 0),
  add column if not exists sector_request_count integer not null default 0 check (sector_request_count >= 0),
  add column if not exists cache_hit_count integer not null default 0 check (cache_hit_count >= 0),
  add column if not exists collapsed_count integer not null default 0 check (collapsed_count >= 0),
  add column if not exists failed_count integer not null default 0 check (failed_count >= 0);

create or replace function public.reserve_research_run(
  p_run_type text,
  p_cache_key text,
  p_input_hash text,
  p_requested_by uuid default null
)
returns table (run_id bigint, owner_token uuid, acquired boolean)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  normalized_type text := lower(trim(p_run_type));
  normalized_key text := trim(p_cache_key);
  new_token uuid := gen_random_uuid();
  inserted_id bigint;
begin
  if normalized_type not in ('stock', 'sector') then
    raise exception using errcode = '22023', message = 'unsupported research run type';
  end if;
  if normalized_key is null or length(normalized_key) < 1 or length(normalized_key) > 200 then
    raise exception using errcode = '22023', message = 'invalid research cache key';
  end if;
  if p_input_hash is null or p_input_hash !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'invalid research input hash';
  end if;

  update public.research_runs
  set status = 'failed',
      completed_at = now(),
      last_error = 'research lock expired',
      updated_at = now()
  where status = 'running' and locked_until <= now();

  insert into public.research_runs (run_type, cache_key, input_hash, owner_token, requested_by)
  values (normalized_type, normalized_key, p_input_hash, new_token, p_requested_by)
  on conflict (run_type, cache_key, input_hash) where status = 'running' do nothing
  returning id into inserted_id;

  if inserted_id is not null then
    return query select inserted_id, new_token, true;
  else
    return query
      select run.id, null::uuid, false
      from public.research_runs as run
      where run.run_type = normalized_type
        and run.cache_key = normalized_key
        and run.input_hash = p_input_hash
        and run.status = 'running'
      order by run.id desc
      limit 1;
  end if;
end;
$$;

create or replace function public.complete_research_run(
  p_run_id bigint,
  p_owner_token uuid,
  p_succeeded boolean,
  p_error text default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_owner_token is null or p_succeeded is null then
    raise exception using errcode = '22023', message = 'owner token and outcome are required';
  end if;
  update public.research_runs
  set status = case when p_succeeded then 'succeeded' else 'failed' end,
      completed_at = now(),
      last_error = case when p_succeeded then null else left(coalesce(p_error, 'research failed'), 2000) end,
      updated_at = now()
  where id = p_run_id and owner_token = p_owner_token and status = 'running';
  if not found then
    raise exception using errcode = '55000', message = 'research run is not owned by this caller';
  end if;
end;
$$;

create or replace function public.reserve_ai_research_budget(p_limit integer, p_kind text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  normalized_kind text := lower(trim(p_kind));
  reserved boolean := false;
begin
  if p_limit is null or p_limit < 1 or p_limit > 500 then
    raise exception using errcode = '22023', message = 'p_limit must be between 1 and 500';
  end if;
  if normalized_kind not in ('stock', 'sector') then
    raise exception using errcode = '22023', message = 'unsupported AI request kind';
  end if;

  insert into public.ai_research_daily_usage (
    usage_date, request_count, stock_request_count, sector_request_count, updated_at
  ) values (
    (now() at time zone 'utc')::date,
    1,
    case when normalized_kind = 'stock' then 1 else 0 end,
    case when normalized_kind = 'sector' then 1 else 0 end,
    now()
  )
  on conflict (usage_date) do update
  set request_count = public.ai_research_daily_usage.request_count + 1,
      stock_request_count = public.ai_research_daily_usage.stock_request_count + case when normalized_kind = 'stock' then 1 else 0 end,
      sector_request_count = public.ai_research_daily_usage.sector_request_count + case when normalized_kind = 'sector' then 1 else 0 end,
      updated_at = now()
  where public.ai_research_daily_usage.request_count < p_limit
  returning true into reserved;
  return coalesce(reserved, false);
end;
$$;

create or replace function public.record_ai_research_event(p_event text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  normalized_event text := lower(trim(p_event));
begin
  if normalized_event not in ('cache_hit', 'collapsed', 'failed') then
    raise exception using errcode = '22023', message = 'unsupported AI telemetry event';
  end if;
  insert into public.ai_research_daily_usage (
    usage_date, cache_hit_count, collapsed_count, failed_count, updated_at
  ) values (
    (now() at time zone 'utc')::date,
    case when normalized_event = 'cache_hit' then 1 else 0 end,
    case when normalized_event = 'collapsed' then 1 else 0 end,
    case when normalized_event = 'failed' then 1 else 0 end,
    now()
  )
  on conflict (usage_date) do update
  set cache_hit_count = public.ai_research_daily_usage.cache_hit_count + case when normalized_event = 'cache_hit' then 1 else 0 end,
      collapsed_count = public.ai_research_daily_usage.collapsed_count + case when normalized_event = 'collapsed' then 1 else 0 end,
      failed_count = public.ai_research_daily_usage.failed_count + case when normalized_event = 'failed' then 1 else 0 end,
      updated_at = now();
end;
$$;

revoke execute on function public.reserve_research_run(text, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.complete_research_run(bigint, uuid, boolean, text) from public, anon, authenticated;
revoke execute on function public.reserve_ai_research_budget(integer, text) from public, anon, authenticated;
revoke execute on function public.record_ai_research_event(text) from public, anon, authenticated;
grant execute on function public.reserve_research_run(text, text, text, uuid) to service_role;
grant execute on function public.complete_research_run(bigint, uuid, boolean, text) to service_role;
grant execute on function public.reserve_ai_research_budget(integer, text) to service_role;
grant execute on function public.record_ai_research_event(text) to service_role;
