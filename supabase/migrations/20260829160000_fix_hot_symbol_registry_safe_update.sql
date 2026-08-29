-- Phase D production fix: keep the registry refresh compatible with
-- Supabase's safe-update guard by limiting the reset to rows that change.

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
      updated_at = now()
  where watchlist_count <> 0
     or is_top_sector;

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

revoke execute on function public.refresh_hot_symbol_registry() from public, anon, authenticated;
grant execute on function public.refresh_hot_symbol_registry() to service_role;
