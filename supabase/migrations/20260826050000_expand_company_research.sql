-- Cross-company fundamentals and short-lived grounded AI research cache.
create table public.financial_periods (
  id bigint generated always as identity primary key,
  symbol text not null references public.stocks(symbol) on update cascade on delete cascade,
  period_type text not null check (period_type in ('quarter', 'year')),
  period_label text not null,
  period_end date,
  revenue numeric,
  gross_profit numeric,
  operating_profit numeric,
  profit_before_tax numeric,
  net_profit numeric,
  eps numeric,
  total_assets numeric,
  total_liabilities numeric,
  equity numeric,
  operating_cash_flow numeric,
  unit text not null default 'VND million',
  source text not null default 'vnstock-community',
  fetched_at timestamptz not null default now(),
  unique (symbol, period_type, period_label)
);

create table public.ai_research_reports (
  id bigint generated always as identity primary key,
  symbol text not null references public.stocks(symbol) on update cascade on delete cascade,
  requested_at timestamptz not null default now(),
  as_of timestamptz not null,
  model text not null,
  summary_text text not null,
  outlook_text text not null,
  catalysts_json jsonb not null default '[]'::jsonb,
  risks_json jsonb not null default '[]'::jsonb,
  forecast_json jsonb not null default '[]'::jsonb,
  citations_json jsonb not null default '[]'::jsonb,
  expires_at timestamptz not null,
  constraint ai_research_catalysts_array check (jsonb_typeof(catalysts_json) = 'array'),
  constraint ai_research_risks_array check (jsonb_typeof(risks_json) = 'array'),
  constraint ai_research_forecast_array check (jsonb_typeof(forecast_json) = 'array'),
  constraint ai_research_citations_array check (jsonb_typeof(citations_json) = 'array')
);

create table public.ai_research_daily_usage (
  usage_date date primary key default (now() at time zone 'utc')::date,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now()
);

create index financial_periods_symbol_period_idx
  on public.financial_periods (symbol, period_type, period_end desc);
create index ai_research_reports_symbol_requested_idx
  on public.ai_research_reports (symbol, requested_at desc);
alter table public.financial_periods enable row level security;
alter table public.ai_research_reports enable row level security;
alter table public.ai_research_daily_usage enable row level security;

revoke all on table public.financial_periods, public.ai_research_reports from anon, authenticated;
grant select on table public.financial_periods, public.ai_research_reports to anon, authenticated;
grant all on table public.financial_periods, public.ai_research_reports to service_role;
revoke all on table public.ai_research_daily_usage from anon, authenticated;
grant all on table public.ai_research_daily_usage to service_role;
grant usage, select on sequence public.financial_periods_id_seq, public.ai_research_reports_id_seq to service_role;

create policy "financial periods are publicly readable by anon"
  on public.financial_periods for select to anon using (true);
create policy "financial periods are publicly readable by authenticated users"
  on public.financial_periods for select to authenticated using (true);
create policy "grounded research is publicly readable by anon"
  on public.ai_research_reports for select to anon using (true);
create policy "grounded research is publicly readable by authenticated users"
  on public.ai_research_reports for select to authenticated using (true);

create or replace function public.reserve_ai_research_request(p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  reserved boolean := false;
begin
  if p_limit < 1 or p_limit > 500 then
    raise exception 'p_limit must be between 1 and 500';
  end if;

  insert into public.ai_research_daily_usage (usage_date, request_count, updated_at)
  values ((now() at time zone 'utc')::date, 1, now())
  on conflict (usage_date) do update
    set request_count = public.ai_research_daily_usage.request_count + 1,
        updated_at = now()
    where public.ai_research_daily_usage.request_count < p_limit
  returning true into reserved;

  return coalesce(reserved, false);
end;
$$;

revoke execute on function public.reserve_ai_research_request(integer) from public, anon, authenticated;
grant execute on function public.reserve_ai_research_request(integer) to service_role;
