-- Phase E: cached official exchange disclosures and per-symbol connector state.

create table public.official_disclosures (
  id bigint generated always as identity primary key,
  symbol text not null references public.stocks(symbol) on update cascade on delete cascade,
  exchange text not null check (exchange in ('HOSE', 'HNX', 'UPCOM')),
  title text not null,
  excerpt text,
  published_at timestamptz not null,
  source_name text not null,
  source_url text not null,
  fetched_at timestamptz not null,
  content_hash text not null,
  data_quality text not null default 'verified',
  created_at timestamptz not null default now(),
  constraint official_disclosures_title_check check (length(title) between 1 and 1000),
  constraint official_disclosures_excerpt_check check (excerpt is null or length(excerpt) <= 2000),
  constraint official_disclosures_source_url_check check (source_url ~ '^https://'),
  constraint official_disclosures_hash_check check (content_hash ~ '^[a-f0-9]{64}$'),
  constraint official_disclosures_quality_check check (data_quality in ('verified', 'partial')),
  unique (source_url),
  unique (symbol, content_hash)
);

create index official_disclosures_symbol_published_idx
  on public.official_disclosures (symbol, published_at desc);

create table public.disclosure_sync_status (
  symbol text primary key references public.stocks(symbol) on update cascade on delete cascade,
  source_name text not null,
  provider_timestamp timestamptz,
  fetched_at timestamptz,
  expires_at timestamptz,
  data_quality text not null default 'unknown',
  last_error text,
  refresh_status text not null default 'idle',
  updated_at timestamptz not null default now(),
  constraint disclosure_sync_quality_check check (data_quality in ('verified', 'partial', 'unknown')),
  constraint disclosure_sync_status_check check (refresh_status in ('idle', 'refreshing', 'ready', 'error'))
);

alter table public.official_disclosures enable row level security;
alter table public.disclosure_sync_status enable row level security;

create policy "Official disclosures are publicly readable"
on public.official_disclosures for select
to anon, authenticated
using (true);

create policy "Disclosure status is publicly readable"
on public.disclosure_sync_status for select
to anon, authenticated
using (true);

revoke all on table public.official_disclosures, public.disclosure_sync_status from anon, authenticated;
grant select on table public.official_disclosures, public.disclosure_sync_status to anon, authenticated;
grant select, insert, update, delete on table public.official_disclosures, public.disclosure_sync_status to service_role;
grant usage, select on sequence public.official_disclosures_id_seq to service_role;

create or replace function public.sync_disclosure_refresh_state()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.data_type <> 'disclosures' or new.status = 'succeeded' then
    return new;
  end if;

  insert into public.disclosure_sync_status (
    symbol,
    source_name,
    last_error,
    refresh_status,
    updated_at
  ) values (
    new.symbol,
    'official-exchange',
    case when new.status = 'failed' then new.last_error else null end,
    case when new.status = 'failed' then 'error' else 'refreshing' end,
    now()
  )
  on conflict (symbol) do update
  set last_error = excluded.last_error,
      refresh_status = excluded.refresh_status,
      updated_at = excluded.updated_at;
  return new;
end;
$$;

create trigger refresh_job_updates_disclosure_status
after insert or update of status, last_error on public.refresh_jobs
for each row execute function public.sync_disclosure_refresh_state();

revoke execute on function public.sync_disclosure_refresh_state() from public, anon, authenticated;
