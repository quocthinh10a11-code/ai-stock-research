-- Phase B: durable refresh orchestration. Provider workers are intentionally
-- separate from user requests and will be selected in a later phase.

create table public.refresh_jobs (
  id bigint generated always as identity primary key,
  symbol text not null references public.stocks(symbol) on update cascade on delete cascade,
  data_type text not null,
  status text not null default 'queued',
  priority smallint not null default 100,
  requested_by uuid references auth.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  available_at timestamptz not null default now(),
  attempt_count integer not null default 0,
  max_attempts integer not null default 4,
  locked_at timestamptz,
  locked_by text,
  completed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint refresh_jobs_data_type_check check (data_type in ('market', 'fundamentals', 'disclosures')),
  constraint refresh_jobs_status_check check (status in ('queued', 'running', 'succeeded', 'failed')),
  constraint refresh_jobs_priority_check check (priority between 1 and 1000),
  constraint refresh_jobs_attempt_count_check check (attempt_count >= 0),
  constraint refresh_jobs_max_attempts_check check (max_attempts between 1 and 10),
  constraint refresh_jobs_lock_check check (
    (status = 'running' and locked_at is not null and locked_by is not null)
    or (status <> 'running' and locked_at is null and locked_by is null)
  ),
  constraint refresh_jobs_completion_check check (
    (status in ('succeeded', 'failed') and completed_at is not null)
    or (status in ('queued', 'running') and completed_at is null)
  )
);

create unique index refresh_jobs_active_symbol_type_key
  on public.refresh_jobs (symbol, data_type)
  where status in ('queued', 'running');

create index refresh_jobs_claim_idx
  on public.refresh_jobs (priority, available_at, requested_at)
  where status = 'queued';

create index refresh_jobs_symbol_requested_idx
  on public.refresh_jobs (symbol, requested_at desc);

alter table public.refresh_jobs enable row level security;

revoke all on table public.refresh_jobs from anon, authenticated;
grant select, insert, update, delete on table public.refresh_jobs to service_role;
grant usage, select on sequence public.refresh_jobs_id_seq to service_role;

create or replace function public.enqueue_refresh_jobs(
  p_symbol text,
  p_data_types text[],
  p_requested_by uuid default null
)
returns table (
  id bigint,
  symbol text,
  data_type text,
  status text,
  requested_at timestamptz,
  available_at timestamptz,
  attempt_count integer,
  max_attempts integer
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  normalized_symbol text := upper(trim(p_symbol));
  requested_type text;
begin
  if normalized_symbol is null or normalized_symbol !~ '^[A-Z0-9]{2,10}$' then
    raise exception using errcode = '22023', message = 'invalid stock symbol';
  end if;
  if coalesce(cardinality(p_data_types), 0) < 1 or cardinality(p_data_types) > 3 then
    raise exception using errcode = '22023', message = 'p_data_types must contain between 1 and 3 values';
  end if;
  if not exists (select 1 from public.stocks as stock where stock.symbol = normalized_symbol) then
    raise exception using errcode = '23503', message = 'stock symbol does not exist';
  end if;

  for requested_type in
    select distinct lower(trim(item))
    from unnest(p_data_types) as item
  loop
    if requested_type is null or requested_type not in ('market', 'fundamentals', 'disclosures') then
      raise exception using errcode = '22023', message = 'unsupported refresh data type';
    end if;

    insert into public.refresh_jobs (symbol, data_type, requested_by)
    values (normalized_symbol, requested_type, p_requested_by)
    on conflict (symbol, data_type) where status in ('queued', 'running') do nothing;

    return query
      select
        job.id,
        job.symbol,
        job.data_type,
        job.status,
        job.requested_at,
        job.available_at,
        job.attempt_count,
        job.max_attempts
      from public.refresh_jobs as job
      where job.symbol = normalized_symbol
        and job.data_type = requested_type
        and job.status in ('queued', 'running')
      order by job.id desc
      limit 1;
  end loop;
end;
$$;

create or replace function public.claim_refresh_jobs(
  p_worker_id text,
  p_limit integer default 10,
  p_lock_timeout_seconds integer default 900
)
returns setof public.refresh_jobs
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_worker_id is null or length(trim(p_worker_id)) < 3 or length(p_worker_id) > 120 then
    raise exception using errcode = '22023', message = 'invalid worker id';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 50 then
    raise exception using errcode = '22023', message = 'p_limit must be between 1 and 50';
  end if;
  if p_lock_timeout_seconds is null or p_lock_timeout_seconds < 60 or p_lock_timeout_seconds > 3600 then
    raise exception using errcode = '22023', message = 'p_lock_timeout_seconds must be between 60 and 3600';
  end if;

  update public.refresh_jobs as job
  set status = 'failed',
      completed_at = now(),
      locked_at = null,
      locked_by = null,
      last_error = coalesce(job.last_error, 'worker lock expired after final attempt'),
      updated_at = now()
  where job.status = 'running'
    and job.attempt_count >= job.max_attempts
    and job.locked_at < now() - make_interval(secs => p_lock_timeout_seconds);

  return query
    with candidates as (
      select job.id
      from public.refresh_jobs as job
      where job.attempt_count < job.max_attempts
        and (
          (job.status = 'queued' and job.available_at <= now())
          or (
            job.status = 'running'
            and job.locked_at < now() - make_interval(secs => p_lock_timeout_seconds)
          )
        )
      order by job.priority, job.available_at, job.requested_at
      for update skip locked
      limit p_limit
    )
    update public.refresh_jobs as job
    set status = 'running',
        attempt_count = job.attempt_count + 1,
        locked_at = now(),
        locked_by = trim(p_worker_id),
        updated_at = now()
    from candidates
    where job.id = candidates.id
    returning job.*;
end;
$$;

create or replace function public.complete_refresh_job(
  p_job_id bigint,
  p_worker_id text,
  p_succeeded boolean,
  p_error text default null
)
returns public.refresh_jobs
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_job public.refresh_jobs;
  result_job public.refresh_jobs;
  retry_seconds double precision;
begin
  if p_worker_id is null or p_succeeded is null then
    raise exception using errcode = '22023', message = 'worker id and outcome are required';
  end if;
  select job.* into current_job
  from public.refresh_jobs as job
  where job.id = p_job_id
  for update;

  if current_job.id is null then
    raise exception using errcode = 'P0002', message = 'refresh job not found';
  end if;
  if current_job.status <> 'running' or current_job.locked_by is distinct from trim(p_worker_id) then
    raise exception using errcode = '55000', message = 'refresh job is not owned by this worker';
  end if;

  if p_succeeded then
    update public.refresh_jobs as job
    set status = 'succeeded',
        completed_at = now(),
        locked_at = null,
        locked_by = null,
        last_error = null,
        updated_at = now()
    where job.id = p_job_id
    returning job.* into result_job;
  elsif current_job.attempt_count >= current_job.max_attempts then
    update public.refresh_jobs as job
    set status = 'failed',
        completed_at = now(),
        locked_at = null,
        locked_by = null,
        last_error = left(coalesce(p_error, 'provider refresh failed'), 2000),
        updated_at = now()
    where job.id = p_job_id
    returning job.* into result_job;
  else
    retry_seconds := least(3600::double precision, 30 * power(2, greatest(current_job.attempt_count - 1, 0)));
    update public.refresh_jobs as job
    set status = 'queued',
        available_at = now() + make_interval(secs => retry_seconds),
        locked_at = null,
        locked_by = null,
        last_error = left(coalesce(p_error, 'provider refresh failed'), 2000),
        updated_at = now()
    where job.id = p_job_id
    returning job.* into result_job;
  end if;

  return result_job;
end;
$$;

revoke execute on function public.enqueue_refresh_jobs(text, text[], uuid) from public, anon, authenticated;
revoke execute on function public.claim_refresh_jobs(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.complete_refresh_job(bigint, text, boolean, text) from public, anon, authenticated;
grant execute on function public.enqueue_refresh_jobs(text, text[], uuid) to service_role;
grant execute on function public.claim_refresh_jobs(text, integer, integer) to service_role;
grant execute on function public.complete_refresh_job(bigint, text, boolean, text) to service_role;
