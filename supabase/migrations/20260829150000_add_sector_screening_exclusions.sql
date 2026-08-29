-- Phase G: classify instruments early and expose bounded screener exclusion provenance.

alter table public.stocks
  add column if not exists instrument_type text not null default 'equity';

alter table public.stocks
  add constraint stocks_instrument_type_check
  check (instrument_type in ('equity', 'etf', 'fund', 'warrant', 'bond', 'other'));

alter table public.sector_screenings
  add column if not exists fundamentals_provider_timestamp timestamptz,
  add column if not exists fundamentals_fetched_at timestamptz;

create table public.sector_screening_exclusions (
  id bigint generated always as identity primary key,
  symbol text not null check (symbol ~ '^[A-Z0-9]{2,10}$'),
  snapshot_date date not null,
  company_name text,
  exchange text check (exchange is null or exchange in ('HOSE', 'HNX')),
  sector_group text,
  instrument_type text not null default 'equity' check (instrument_type in ('equity', 'etf', 'fund', 'warrant', 'bond', 'other')),
  phase text not null check (phase in ('universe', 'quote', 'fundamentals', 'intraday')),
  reason_code text not null,
  reason_detail text not null,
  provider_timestamp timestamptz,
  fetched_at timestamptz not null default now(),
  source_name text not null default 'vnstock-community-v4/vci-kbs',
  data_quality text not null default 'observed',
  unique (symbol, snapshot_date, reason_code)
);

create index sector_screening_exclusions_date_sector_idx
  on public.sector_screening_exclusions (snapshot_date desc, sector_group, reason_code);

alter table public.sector_screening_exclusions enable row level security;
revoke all on table public.sector_screening_exclusions from anon, authenticated;
grant select on table public.sector_screening_exclusions to anon, authenticated;
grant select, insert, update, delete on table public.sector_screening_exclusions to service_role;
grant usage, select on sequence public.sector_screening_exclusions_id_seq to service_role;

create policy "sector exclusions are publicly readable by anon"
  on public.sector_screening_exclusions for select to anon using (true);
create policy "sector exclusions are publicly readable by authenticated users"
  on public.sector_screening_exclusions for select to authenticated using (true);

create or replace view public.latest_sector_screening_exclusions
with (security_invoker = true)
as
select exclusion.*
from public.sector_screening_exclusions as exclusion
where exclusion.snapshot_date = (
  select max(latest.snapshot_date) from public.sector_screening_exclusions as latest
  where latest.phase <> 'intraday'
)
and exclusion.phase <> 'intraday'
union all
select exclusion.*
from public.sector_screening_exclusions as exclusion
where exclusion.snapshot_date = (
  select max(latest.snapshot_date) from public.sector_screening_exclusions as latest
  where latest.phase = 'intraday'
)
and exclusion.phase = 'intraday';

revoke all on table public.latest_sector_screening_exclusions from anon, authenticated;
grant select on table public.latest_sector_screening_exclusions to anon, authenticated, service_role;

create or replace view public.latest_sector_exclusion_summary
with (security_invoker = true)
as
select
  exclusion.sector_group,
  exclusion.reason_code,
  min(exclusion.reason_detail) as reason_detail,
  count(*)::integer as excluded_count,
  (array_agg(exclusion.symbol order by exclusion.symbol))[1:12] as sample_symbols,
  max(exclusion.fetched_at) as observed_at
from public.latest_sector_screening_exclusions as exclusion
group by exclusion.sector_group, exclusion.reason_code;

revoke all on table public.latest_sector_exclusion_summary from anon, authenticated;
grant select on table public.latest_sector_exclusion_summary to anon, authenticated, service_role;
