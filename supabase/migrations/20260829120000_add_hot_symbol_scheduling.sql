-- Phase D: hot/warm/cold classification and quota-aware scheduled refreshes.

create table public.hot_symbols (
  symbol text primary key references public.stocks(symbol) on update cascade on delete cascade,
  last_viewed_at timestamptz,
  last_searched_at timestamptz,
  hot_until timestamptz,
  watchlist_count integer not null default 0 check (watchlist_count >= 0),
  is_top_sector boolean not null default false,
  last_enqueued_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.hot_symbols enable row level security;
revoke all on table public.hot_symbols from anon, authenticated;
grant select, insert, update, delete on table public.hot_symbols to service_role;

create or replace view public.symbol_refresh_tiers
with (security_invoker = true)
as
select
  stock.symbol,
  case
    when activity.watchlist_count > 0
      or activity.is_top_sector
      or activity.hot_until > now()
      then 'hot'
    when greatest(activity.last_viewed_at, activity.last_searched_at) > now() - interval '30 days'
      then 'warm'
    else 'cold'
  end as heat_tier,
  activity.last_viewed_at,
  activity.last_searched_at,
  activity.hot_until,
  coalesce(activity.watchlist_count, 0) as watchlist_count,
  coalesce(activity.is_top_sector, false) as is_top_sector,
  activity.last_enqueued_at
from public.stocks as stock
left join public.hot_symbols as activity on activity.symbol = stock.symbol;

revoke all on table public.symbol_refresh_tiers from public, anon, authenticated;
grant select on table public.symbol_refresh_tiers to service_role;

create or replace function public.touch_hot_symbol(
  p_symbol text,
  p_reason text,
  p_hot_minutes integer default 60
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  normalized_symbol text := upper(trim(p_symbol));
  normalized_reason text := lower(trim(p_reason));
begin
  if normalized_symbol is null or normalized_symbol !~ '^[A-Z0-9]{2,10}$' then
    raise exception using errcode = '22023', message = 'invalid stock symbol';
  end if;
  if normalized_reason not in ('search', 'view', 'watchlist') then
    raise exception using errcode = '22023', message = 'unsupported activity reason';
  end if;
  if p_hot_minutes is null or p_hot_minutes < 15 or p_hot_minutes > 1440 then
    raise exception using errcode = '22023', message = 'p_hot_minutes must be between 15 and 1440';
  end if;

  insert into public.hot_symbols (
    symbol,
    last_viewed_at,
    last_searched_at,
    hot_until,
    updated_at
  ) values (
    normalized_symbol,
    case when normalized_reason = 'view' then now() else null end,
    case when normalized_reason = 'search' then now() else null end,
    now() + make_interval(mins => p_hot_minutes),
    now()
  )
  on conflict (symbol) do update
  set last_viewed_at = case
        when normalized_reason = 'view' then now()
        else public.hot_symbols.last_viewed_at
      end,
      last_searched_at = case
        when normalized_reason = 'search' then now()
        else public.hot_symbols.last_searched_at
      end,
      hot_until = greatest(public.hot_symbols.hot_until, excluded.hot_until),
      updated_at = now();
end;
$$;

create or replace function public.refresh_hot_symbol_registry()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.hot_symbols
  set watchlist_count = 0,
      is_top_sector = false,
      updated_at = now();

  insert into public.hot_symbols (symbol, watchlist_count, hot_until, updated_at)
  select watchlist.symbol, count(*)::integer, now() + interval '1 day', now()
  from public.user_watchlist as watchlist
  group by watchlist.symbol
  on conflict (symbol) do update
  set watchlist_count = excluded.watchlist_count,
      hot_until = greatest(public.hot_symbols.hot_until, excluded.hot_until),
      updated_at = now();

  insert into public.hot_symbols (symbol, last_viewed_at, hot_until, updated_at)
  select history.symbol, max(history.viewed_at), max(history.viewed_at) + interval '1 hour', now()
  from public.research_history as history
  where history.viewed_at > now() - interval '30 days'
  group by history.symbol
  on conflict (symbol) do update
  set last_viewed_at = greatest(public.hot_symbols.last_viewed_at, excluded.last_viewed_at),
      hot_until = greatest(public.hot_symbols.hot_until, excluded.hot_until),
      updated_at = now();

  insert into public.hot_symbols (symbol, is_top_sector, hot_until, updated_at)
  select ranked.symbol, true, now() + interval '1 day', now()
  from (
    select
      screening.symbol,
      row_number() over (
        partition by screening.sector_group
        order by screening.score desc, screening.symbol
      ) as sector_rank
    from public.latest_sector_screenings as screening
    where screening.eligible
  ) as ranked
  where ranked.sector_rank <= 5
  on conflict (symbol) do update
  set is_top_sector = true,
      hot_until = greatest(public.hot_symbols.hot_until, excluded.hot_until),
      updated_at = now();
end;
$$;

create or replace function public.prepare_scheduled_refresh_jobs(
  p_shard integer default 0,
  p_shard_count integer default 4,
  p_limit integer default 4
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  candidate record;
  inserted_id bigint;
  inserted_count integer := 0;
begin
  if p_shard is null or p_shard_count is null or p_shard_count < 1 or p_shard_count > 16
     or p_shard < 0 or p_shard >= p_shard_count then
    raise exception using errcode = '22023', message = 'invalid shard configuration';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 12 then
    raise exception using errcode = '22023', message = 'p_limit must be between 1 and 12';
  end if;

  perform public.refresh_hot_symbol_registry();

  for candidate in
    select tier.symbol, tier.heat_tier
    from public.symbol_refresh_tiers as tier
    left join public.current_market_snapshots as snapshot on snapshot.symbol = tier.symbol
    where tier.heat_tier in ('hot', 'warm')
      and mod((hashtextextended(tier.symbol, 0) & 2147483647)::integer, p_shard_count) = p_shard
      and (
        tier.last_enqueued_at is null
        or tier.last_enqueued_at <= now() - case
          when tier.heat_tier = 'hot' then interval '15 minutes'
          else interval '60 minutes'
        end
      )
      and (
        snapshot.price_fetched_at is null
        or snapshot.price_fetched_at <= now() - case
          when tier.heat_tier = 'hot' then interval '15 minutes'
          else interval '60 minutes'
        end
      )
    order by
      case tier.heat_tier when 'hot' then 0 else 1 end,
      tier.last_enqueued_at nulls first,
      tier.symbol
    limit p_limit
  loop
    inserted_id := null;
    insert into public.refresh_jobs (symbol, data_type, priority)
    values (candidate.symbol, 'market', case when candidate.heat_tier = 'hot' then 10 else 50 end)
    on conflict (symbol, data_type) where status in ('queued', 'running') do nothing
    returning id into inserted_id;

    if inserted_id is not null then
      update public.hot_symbols
      set last_enqueued_at = now(), updated_at = now()
      where symbol = candidate.symbol;
      inserted_count := inserted_count + 1;
    end if;
  end loop;

  return inserted_count;
end;
$$;

revoke execute on function public.touch_hot_symbol(text, text, integer) from public, anon, authenticated;
revoke execute on function public.refresh_hot_symbol_registry() from public, anon, authenticated;
revoke execute on function public.prepare_scheduled_refresh_jobs(integer, integer, integer) from public, anon, authenticated;
grant execute on function public.touch_hot_symbol(text, text, integer) to service_role;
grant execute on function public.refresh_hot_symbol_registry() to service_role;
grant execute on function public.prepare_scheduled_refresh_jobs(integer, integer, integer) to service_role;
