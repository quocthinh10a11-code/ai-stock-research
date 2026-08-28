-- Cached, publicly readable market screener. Only service_role jobs may write.
alter table public.stocks
  add column if not exists icb_level2_code text,
  add column if not exists icb_level2_name text,
  add column if not exists sector_group text;

create table public.sector_screenings (
  id bigint generated always as identity primary key,
  symbol text not null references public.stocks(symbol) on update cascade on delete cascade,
  snapshot_date date not null,
  as_of timestamptz not null,
  sector_group text not null,
  industry text not null,
  exchange text not null check (exchange in ('HOSE', 'HNX')),
  price numeric(18, 4) not null check (price >= 0),
  change_pct numeric(12, 6),
  market_cap numeric(24, 2),
  average_volume20 numeric(20, 2),
  financial_period text,
  pe numeric(14, 4),
  pb numeric(14, 4),
  roe numeric(14, 4),
  revenue_growth numeric(14, 4),
  profit_growth numeric(14, 4),
  debt_to_equity numeric(14, 4),
  gross_margin numeric(14, 4),
  current_ratio numeric(14, 4),
  inventory_turnover numeric(14, 4),
  dividend_yield numeric(14, 4),
  nim numeric(14, 4),
  npl numeric(14, 4),
  llcr numeric(14, 4),
  trading_status text,
  security_status text,
  score integer not null check (score between 0 and 100),
  passed_criteria integer not null check (passed_criteria >= 0),
  available_criteria integer not null check (available_criteria >= 0),
  eligible boolean not null default false,
  criteria_json jsonb not null default '[]'::jsonb,
  source text not null default 'vnstock-community-v4',
  unique (symbol, snapshot_date),
  constraint sector_screenings_group_check check (sector_group in ('Tài chính', 'Bất động sản & Xây dựng', 'Dầu khí & Năng lượng', 'Vật liệu cơ bản', 'Công nghiệp', 'Hàng tiêu dùng', 'Dịch vụ tiêu dùng', 'Y tế & Dược phẩm', 'Công nghệ thông tin', 'Tiện ích công cộng')),
  constraint sector_screenings_criteria_array check (jsonb_typeof(criteria_json) = 'array')
);

create table public.sector_ai_briefs (
  sector_group text primary key,
  symbols_json jsonb not null default '[]'::jsonb,
  summary_text text not null,
  highlights_json jsonb not null default '[]'::jsonb,
  citations_json jsonb not null default '[]'::jsonb,
  as_of timestamptz not null,
  expires_at timestamptz not null,
  model text not null,
  constraint sector_ai_group_check check (sector_group in ('Tài chính', 'Bất động sản & Xây dựng', 'Dầu khí & Năng lượng', 'Vật liệu cơ bản', 'Công nghiệp', 'Hàng tiêu dùng', 'Dịch vụ tiêu dùng', 'Y tế & Dược phẩm', 'Công nghệ thông tin', 'Tiện ích công cộng')),
  constraint sector_ai_symbols_array check (jsonb_typeof(symbols_json) = 'array'),
  constraint sector_ai_highlights_array check (jsonb_typeof(highlights_json) = 'array'),
  constraint sector_ai_citations_array check (jsonb_typeof(citations_json) = 'array')
);

create index sector_screenings_date_group_score_idx
  on public.sector_screenings (snapshot_date desc, sector_group, score desc);

alter table public.sector_screenings enable row level security;
alter table public.sector_ai_briefs enable row level security;

revoke all on table public.sector_screenings, public.sector_ai_briefs from anon, authenticated;
grant select on table public.sector_screenings, public.sector_ai_briefs to anon, authenticated;
grant select, insert, update, delete on table public.sector_screenings, public.sector_ai_briefs to service_role;
grant usage, select on sequence public.sector_screenings_id_seq to service_role;

create policy "sector screenings are publicly readable by anon"
  on public.sector_screenings for select to anon using (true);
create policy "sector screenings are publicly readable by authenticated users"
  on public.sector_screenings for select to authenticated using (true);
create policy "sector AI briefs are publicly readable by anon"
  on public.sector_ai_briefs for select to anon using (true);
create policy "sector AI briefs are publicly readable by authenticated users"
  on public.sector_ai_briefs for select to authenticated using (true);

create or replace view public.latest_sector_screenings
with (security_invoker = true)
as
select screening.*, stocks.company_name
from public.sector_screenings as screening
join public.stocks on stocks.symbol = screening.symbol
where screening.snapshot_date = (
  select max(latest.snapshot_date)
  from public.sector_screenings as latest
);

revoke all on table public.latest_sector_screenings from anon, authenticated;
grant select on table public.latest_sector_screenings to anon, authenticated, service_role;
