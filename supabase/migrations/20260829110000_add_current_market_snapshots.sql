-- Phase C: one aggregate row per symbol for cache-first reads and Realtime.

create table public.current_market_snapshots (
  symbol text primary key references public.stocks(symbol) on update cascade on delete cascade,
  price_date date,
  close numeric,
  previous_close numeric,
  bias text check (bias in ('bullish', 'neutral', 'bearish')),
  rsi14 numeric,
  relative_volume numeric,
  ema20 numeric,
  ema50 numeric,
  price_provider_timestamp timestamptz,
  price_fetched_at timestamptz,
  price_expires_at timestamptz,
  price_source_name text not null default 'vnstock-community-v4',
  price_source_url text,
  price_data_quality text not null default 'unknown',
  price_last_error text,
  price_refresh_status text not null default 'idle',
  technical_provider_timestamp timestamptz,
  technical_fetched_at timestamptz,
  technical_expires_at timestamptz,
  technical_source_name text not null default 'vnstock-community-v4/rule-based-indicators',
  technical_source_url text,
  technical_data_quality text not null default 'unknown',
  technical_last_error text,
  technical_refresh_status text not null default 'idle',
  updated_at timestamptz not null default now(),
  constraint current_market_snapshots_price_quality_check check (
    price_data_quality in ('verified', 'verified-sources', 'partial', 'estimated', 'delayed', 'eod', 'unknown')
  ),
  constraint current_market_snapshots_technical_quality_check check (
    technical_data_quality in ('verified', 'verified-sources', 'partial', 'estimated', 'delayed', 'eod', 'unknown')
  ),
  constraint current_market_snapshots_price_status_check check (
    price_refresh_status in ('idle', 'refreshing', 'ready', 'error')
  ),
  constraint current_market_snapshots_technical_status_check check (
    technical_refresh_status in ('idle', 'refreshing', 'ready', 'error')
  )
);

alter table public.current_market_snapshots enable row level security;

create policy "Public market snapshots are readable"
on public.current_market_snapshots for select
to anon, authenticated
using (true);

revoke all on table public.current_market_snapshots from anon, authenticated;
grant select on table public.current_market_snapshots to anon, authenticated;
grant select, insert, update, delete on table public.current_market_snapshots to service_role;

insert into public.current_market_snapshots (
  symbol,
  price_date,
  close,
  previous_close,
  bias,
  rsi14,
  relative_volume,
  ema20,
  ema50,
  price_provider_timestamp,
  price_fetched_at,
  price_expires_at,
  price_source_name,
  price_source_url,
  price_data_quality,
  price_last_error,
  price_refresh_status,
  technical_provider_timestamp,
  technical_fetched_at,
  technical_expires_at,
  technical_source_name,
  technical_source_url,
  technical_data_quality,
  technical_last_error,
  technical_refresh_status,
  updated_at
)
select
  snapshot.symbol,
  snapshot.price_date,
  snapshot.close,
  snapshot.previous_close,
  snapshot.bias,
  snapshot.rsi14,
  snapshot.relative_volume,
  snapshot.ema20,
  snapshot.ema50,
  snapshot.price_provider_timestamp,
  snapshot.price_fetched_at,
  snapshot.price_expires_at,
  coalesce(snapshot.price_source_name, 'vnstock-community-v4'),
  snapshot.price_source_url,
  coalesce(snapshot.price_data_quality, 'unknown'),
  snapshot.price_last_error,
  coalesce(snapshot.price_refresh_status, 'idle'),
  snapshot.technical_provider_timestamp,
  snapshot.technical_fetched_at,
  snapshot.technical_expires_at,
  coalesce(snapshot.technical_source_name, 'vnstock-community-v4/rule-based-indicators'),
  snapshot.technical_source_url,
  coalesce(snapshot.technical_data_quality, 'unknown'),
  snapshot.technical_last_error,
  coalesce(snapshot.technical_refresh_status, 'idle'),
  coalesce(snapshot.price_fetched_at, snapshot.technical_fetched_at, now())
from public.latest_market_snapshots as snapshot
on conflict (symbol) do nothing;

create or replace function public.sync_market_refresh_state()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.data_type <> 'market' then
    return new;
  end if;
  if new.status = 'succeeded' then
    return new;
  end if;

  insert into public.current_market_snapshots (
    symbol,
    price_refresh_status,
    technical_refresh_status,
    price_last_error,
    technical_last_error,
    updated_at
  ) values (
    new.symbol,
    case when new.status = 'failed' then 'error' else 'refreshing' end,
    case when new.status = 'failed' then 'error' else 'refreshing' end,
    case when new.status = 'failed' then new.last_error else null end,
    case when new.status = 'failed' then new.last_error else null end,
    now()
  )
  on conflict (symbol) do update
  set price_refresh_status = excluded.price_refresh_status,
      technical_refresh_status = excluded.technical_refresh_status,
      price_last_error = excluded.price_last_error,
      technical_last_error = excluded.technical_last_error,
      updated_at = excluded.updated_at;

  return new;
end;
$$;

create trigger refresh_job_updates_current_market_snapshot
after insert or update of status, last_error on public.refresh_jobs
for each row execute function public.sync_market_refresh_state();

revoke execute on function public.sync_market_refresh_state() from public, anon, authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'current_market_snapshots'
  ) then
    alter publication supabase_realtime add table public.current_market_snapshots;
  end if;
end;
$$;
