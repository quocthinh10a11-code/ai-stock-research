-- Phase A: explicit freshness and provenance metadata for existing cached data.
-- This does not enable Realtime or add refresh orchestration.

alter table public.price_history
  add column if not exists provider_timestamp timestamptz,
  add column if not exists fetched_at timestamptz,
  add column if not exists expires_at timestamptz,
  add column if not exists source_name text not null default 'vnstock-community-v4',
  add column if not exists source_url text,
  add column if not exists data_quality text not null default 'unknown',
  add column if not exists content_hash text,
  add column if not exists last_error text,
  add column if not exists refresh_status text not null default 'ready';

alter table public.evidence_snapshots
  add column if not exists provider_timestamp timestamptz,
  add column if not exists fetched_at timestamptz,
  add column if not exists expires_at timestamptz,
  add column if not exists source_name text not null default 'vnstock-community-v4/rule-based-indicators',
  add column if not exists source_url text,
  add column if not exists data_quality text not null default 'unknown',
  add column if not exists content_hash text,
  add column if not exists last_error text,
  add column if not exists refresh_status text not null default 'ready';

alter table public.agent_analysis
  add column if not exists provider_timestamp timestamptz,
  add column if not exists fetched_at timestamptz,
  add column if not exists expires_at timestamptz,
  add column if not exists source_name text not null default 'rule-based-analysis',
  add column if not exists source_url text,
  add column if not exists data_quality text not null default 'unknown',
  add column if not exists content_hash text,
  add column if not exists last_error text,
  add column if not exists refresh_status text not null default 'ready';

alter table public.financial_periods
  add column if not exists provider_timestamp timestamptz,
  add column if not exists expires_at timestamptz,
  add column if not exists source_name text,
  add column if not exists source_url text,
  add column if not exists data_quality text not null default 'unknown',
  add column if not exists content_hash text,
  add column if not exists last_error text,
  add column if not exists refresh_status text not null default 'ready';

alter table public.sector_screenings
  add column if not exists provider_timestamp timestamptz,
  add column if not exists fetched_at timestamptz,
  add column if not exists expires_at timestamptz,
  add column if not exists source_name text,
  add column if not exists source_url text,
  add column if not exists data_quality text not null default 'unknown',
  add column if not exists content_hash text,
  add column if not exists last_error text,
  add column if not exists refresh_status text not null default 'ready';

alter table public.ai_research_reports
  add column if not exists provider_timestamp timestamptz,
  add column if not exists fetched_at timestamptz,
  add column if not exists source_name text not null default 'internet-research+gemini',
  add column if not exists source_url text,
  add column if not exists data_quality text not null default 'verified-sources',
  add column if not exists content_hash text,
  add column if not exists last_error text,
  add column if not exists refresh_status text not null default 'ready';

alter table public.sector_ai_briefs
  add column if not exists provider_timestamp timestamptz,
  add column if not exists fetched_at timestamptz,
  add column if not exists source_name text not null default 'tavily+gemini',
  add column if not exists source_url text,
  add column if not exists data_quality text not null default 'verified-sources',
  add column if not exists content_hash text,
  add column if not exists last_error text,
  add column if not exists refresh_status text not null default 'ready';

update public.financial_periods
set source_name = source
where source_name is null;

update public.sector_screenings
set provider_timestamp = coalesce(provider_timestamp, as_of),
    fetched_at = coalesce(fetched_at, as_of),
    expires_at = coalesce(expires_at, as_of + interval '30 minutes'),
    source_name = coalesce(source_name, source)
where provider_timestamp is null
   or fetched_at is null
   or expires_at is null
   or source_name is null;

update public.ai_research_reports
set provider_timestamp = coalesce(provider_timestamp, as_of),
    fetched_at = coalesce(fetched_at, requested_at)
where provider_timestamp is null or fetched_at is null;

update public.sector_ai_briefs
set provider_timestamp = coalesce(provider_timestamp, as_of),
    fetched_at = coalesce(fetched_at, as_of)
where provider_timestamp is null or fetched_at is null;

alter table public.financial_periods alter column source_name set not null;
alter table public.sector_screenings alter column source_name set not null;
alter table public.financial_periods alter column source_name set default 'vnstock-community';
alter table public.sector_screenings alter column source_name set default 'vnstock-community-v4/vci-kbs';

alter table public.price_history
  add constraint price_history_data_quality_check check (data_quality in ('verified', 'verified-sources', 'partial', 'estimated', 'delayed', 'eod', 'unknown')),
  add constraint price_history_refresh_status_check check (refresh_status in ('idle', 'refreshing', 'ready', 'error'));
alter table public.evidence_snapshots
  add constraint evidence_snapshots_data_quality_check check (data_quality in ('verified', 'verified-sources', 'partial', 'estimated', 'delayed', 'eod', 'unknown')),
  add constraint evidence_snapshots_refresh_status_check check (refresh_status in ('idle', 'refreshing', 'ready', 'error'));
alter table public.agent_analysis
  add constraint agent_analysis_data_quality_check check (data_quality in ('verified', 'verified-sources', 'partial', 'estimated', 'delayed', 'eod', 'unknown')),
  add constraint agent_analysis_refresh_status_check check (refresh_status in ('idle', 'refreshing', 'ready', 'error'));
alter table public.financial_periods
  add constraint financial_periods_data_quality_check check (data_quality in ('verified', 'verified-sources', 'partial', 'estimated', 'delayed', 'eod', 'unknown')),
  add constraint financial_periods_refresh_status_check check (refresh_status in ('idle', 'refreshing', 'ready', 'error'));
alter table public.sector_screenings
  add constraint sector_screenings_data_quality_check check (data_quality in ('verified', 'verified-sources', 'partial', 'estimated', 'delayed', 'eod', 'unknown')),
  add constraint sector_screenings_refresh_status_check check (refresh_status in ('idle', 'refreshing', 'ready', 'error'));
alter table public.ai_research_reports
  add constraint ai_research_reports_data_quality_check check (data_quality in ('verified', 'verified-sources', 'partial', 'estimated', 'delayed', 'eod', 'unknown')),
  add constraint ai_research_reports_refresh_status_check check (refresh_status in ('idle', 'refreshing', 'ready', 'error'));
alter table public.sector_ai_briefs
  add constraint sector_ai_briefs_data_quality_check check (data_quality in ('verified', 'verified-sources', 'partial', 'estimated', 'delayed', 'eod', 'unknown')),
  add constraint sector_ai_briefs_refresh_status_check check (refresh_status in ('idle', 'refreshing', 'ready', 'error'));

create or replace view public.latest_market_snapshots
with (security_invoker = true)
as
select
  stocks.symbol,
  stocks.company_name,
  stocks.sector,
  stocks.exchange,
  latest_price.date as price_date,
  latest_price.close,
  latest_price.previous_close,
  latest_analysis.bias,
  latest_analysis.bias_label,
  latest_analysis.analysis_date,
  latest_signals.rsi14,
  latest_signals.relative_volume,
  latest_signals.ema20,
  latest_signals.ema50,
  latest_price.provider_timestamp as price_provider_timestamp,
  latest_price.fetched_at as price_fetched_at,
  latest_price.expires_at as price_expires_at,
  latest_price.source_name as price_source_name,
  latest_price.source_url as price_source_url,
  latest_price.data_quality as price_data_quality,
  latest_price.last_error as price_last_error,
  latest_price.refresh_status as price_refresh_status,
  latest_signals.provider_timestamp as technical_provider_timestamp,
  latest_signals.fetched_at as technical_fetched_at,
  latest_signals.expires_at as technical_expires_at,
  latest_signals.source_name as technical_source_name,
  latest_signals.source_url as technical_source_url,
  latest_signals.data_quality as technical_data_quality,
  latest_signals.last_error as technical_last_error,
  latest_signals.refresh_status as technical_refresh_status
from public.stocks
left join lateral (
  select
    current_price.date,
    current_price.close,
    current_price.provider_timestamp,
    current_price.fetched_at,
    current_price.expires_at,
    current_price.source_name,
    current_price.source_url,
    current_price.data_quality,
    current_price.last_error,
    current_price.refresh_status,
    (
      select prior.close
      from public.price_history as prior
      where prior.symbol = stocks.symbol and prior.date < current_price.date
      order by prior.date desc
      limit 1
    ) as previous_close
  from public.price_history as current_price
  where current_price.symbol = stocks.symbol
  order by current_price.date desc
  limit 1
) as latest_price on true
left join lateral (
  select analysis.analysis_date, analysis.bias, analysis.bias_label
  from public.agent_analysis as analysis
  where analysis.symbol = stocks.symbol
  order by analysis.analysis_date desc
  limit 1
) as latest_analysis on true
left join lateral (
  select
    max(evidence.signal_value) filter (where evidence.signal_name = 'rsi14') as rsi14,
    max(evidence.signal_value) filter (where evidence.signal_name = 'relative_volume') as relative_volume,
    max(evidence.signal_value) filter (where evidence.signal_name = 'ema20') as ema20,
    max(evidence.signal_value) filter (where evidence.signal_name = 'ema50') as ema50,
    max(evidence.provider_timestamp) as provider_timestamp,
    max(evidence.fetched_at) as fetched_at,
    max(evidence.expires_at) as expires_at,
    max(evidence.source_name) as source_name,
    max(evidence.source_url) as source_url,
    max(evidence.data_quality) as data_quality,
    max(evidence.last_error) as last_error,
    max(evidence.refresh_status) as refresh_status
  from public.evidence_snapshots as evidence
  where evidence.symbol = stocks.symbol
    and evidence.date = (
      select max(latest_evidence.date)
      from public.evidence_snapshots as latest_evidence
      where latest_evidence.symbol = stocks.symbol
    )
) as latest_signals on true;

revoke all on table public.latest_market_snapshots from anon, authenticated;
grant select on table public.latest_market_snapshots to anon, authenticated, service_role;

create or replace view public.latest_sector_screenings
with (security_invoker = true)
as
select
  screening.id,
  screening.symbol,
  screening.snapshot_date,
  screening.as_of,
  screening.sector_group,
  screening.industry,
  screening.exchange,
  screening.price,
  screening.change_pct,
  screening.market_cap,
  screening.average_volume20,
  screening.financial_period,
  screening.pe,
  screening.pb,
  screening.roe,
  screening.revenue_growth,
  screening.profit_growth,
  screening.debt_to_equity,
  screening.gross_margin,
  screening.current_ratio,
  screening.inventory_turnover,
  screening.dividend_yield,
  screening.nim,
  screening.npl,
  screening.llcr,
  screening.trading_status,
  screening.security_status,
  screening.score,
  screening.passed_criteria,
  screening.available_criteria,
  screening.eligible,
  screening.criteria_json,
  screening.source,
  stocks.company_name,
  screening.provider_timestamp,
  screening.fetched_at,
  screening.expires_at,
  screening.source_name,
  screening.source_url,
  screening.data_quality,
  screening.content_hash,
  screening.last_error,
  screening.refresh_status
from public.sector_screenings as screening
join public.stocks on stocks.symbol = screening.symbol
where screening.snapshot_date = (
  select max(latest.snapshot_date)
  from public.sector_screenings as latest
);

revoke all on table public.latest_sector_screenings from anon, authenticated;
grant select on table public.latest_sector_screenings to anon, authenticated, service_role;
