-- Per-user research state. Every policy ties the row to auth.uid().

create table public.user_watchlist (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  added_at timestamptz not null default now(),
  notes text,
  constraint user_watchlist_symbol_format check (symbol ~ '^[A-Z0-9]{2,10}$'),
  constraint user_watchlist_user_symbol_key unique (user_id, symbol)
);

create table public.research_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  viewed_at timestamptz not null default now(),
  constraint research_history_symbol_format check (symbol ~ '^[A-Z0-9]{2,10}$')
);

create table public.user_portfolio_selection (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  strategy_type text not null,
  selected_at timestamptz not null default now(),
  constraint user_portfolio_selection_strategy_check check (strategy_type in ('growth', 'dividend', 'value', 'defensive')),
  constraint user_portfolio_selection_user_key unique (user_id)
);

create index user_watchlist_user_id_idx on public.user_watchlist (user_id);
create index research_history_user_viewed_idx on public.research_history (user_id, viewed_at desc);
create index user_portfolio_selection_user_id_idx on public.user_portfolio_selection (user_id);

alter table public.user_watchlist enable row level security;
alter table public.research_history enable row level security;
alter table public.user_portfolio_selection enable row level security;

revoke all on table public.user_watchlist, public.research_history, public.user_portfolio_selection from anon, authenticated;
grant select, insert, update, delete on table public.user_watchlist, public.research_history, public.user_portfolio_selection to authenticated;
grant usage, select on sequence public.user_watchlist_id_seq, public.research_history_id_seq, public.user_portfolio_selection_id_seq to authenticated;
grant all on table public.user_watchlist, public.research_history, public.user_portfolio_selection to service_role;
grant usage, select on sequence public.user_watchlist_id_seq, public.research_history_id_seq, public.user_portfolio_selection_id_seq to service_role;

create policy "users can read their own watchlist"
  on public.user_watchlist for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "users can add to their own watchlist"
  on public.user_watchlist for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "users can update their own watchlist"
  on public.user_watchlist for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "users can remove from their own watchlist"
  on public.user_watchlist for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "users can read their own research history"
  on public.research_history for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "users can add their own research history"
  on public.research_history for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "users can update their own research history"
  on public.research_history for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "users can delete their own research history"
  on public.research_history for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "users can read their own portfolio selection"
  on public.user_portfolio_selection for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "users can add their own portfolio selection"
  on public.user_portfolio_selection for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "users can update their own portfolio selection"
  on public.user_portfolio_selection for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "users can delete their own portfolio selection"
  on public.user_portfolio_selection for delete to authenticated
  using ((select auth.uid()) = user_id);
