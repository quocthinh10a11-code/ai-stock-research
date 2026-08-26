-- A security-invoker read model for dashboard and screener queries.
create view public.latest_market_snapshots
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
  latest_signals.ema50
from public.stocks
left join lateral (
  select
    current_price.date,
    current_price.close,
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
    max(evidence.signal_value) filter (where evidence.signal_name = 'ema50') as ema50
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
