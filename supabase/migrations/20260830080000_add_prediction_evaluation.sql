-- Persist AI scenarios once per symbol/date/horizon and evaluate them against the first EOD close on/after maturity.
alter table public.prediction_log
  add column if not exists evaluated_at timestamptz;

create unique index if not exists prediction_log_symbol_target_unique_idx
  on public.prediction_log (symbol, prediction_date, target_check_date);

create or replace function public.try_prediction_entry_price(value text)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
begin
  return (value::jsonb ->> 'entryPrice')::numeric;
exception when others then
  return null;
end;
$$;

create or replace function public.evaluate_due_predictions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  evaluated_count integer;
begin
  with candidates as (
    select prediction.*, public.try_prediction_entry_price(prediction.scenario_text) as entry_price
    from public.prediction_log as prediction
    where prediction.outcome_status = 'pending'
      and prediction.target_check_date <= current_date
  ), due as (
    select
      prediction.id,
      ((market.close - prediction.entry_price)
        / nullif(prediction.entry_price, 0)) * 100 as actual_return
    from candidates as prediction
    join lateral (
      select price.close
      from public.price_history as price
      where price.symbol = prediction.symbol
        and price.date >= prediction.target_check_date
      order by price.date asc
      limit 1
    ) as market on true
    where prediction.entry_price is not null
  )
  update public.prediction_log as prediction
  set actual_return_pct = due.actual_return,
      outcome_status = case
        when prediction.bias_at_prediction = 'bullish' and due.actual_return > 3 then 'correct'
        when prediction.bias_at_prediction = 'bearish' and due.actual_return < -3 then 'correct'
        when prediction.bias_at_prediction = 'neutral' and abs(due.actual_return) <= 3 then 'correct'
        when due.actual_return is null then 'inconclusive'
        else 'incorrect'
      end,
      evaluated_at = now()
  from due
  where prediction.id = due.id;

  get diagnostics evaluated_count = row_count;
  return evaluated_count;
end;
$$;

revoke all on function public.evaluate_due_predictions() from public, anon, authenticated;
grant execute on function public.evaluate_due_predictions() to service_role;
revoke all on function public.try_prediction_entry_price(text) from public, anon, authenticated;
grant execute on function public.try_prediction_entry_price(text) to service_role;
