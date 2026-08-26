-- Shared market data. Client roles can read these tables; only trusted backend
-- jobs using the service role can mutate them.

create table public.stocks (
  symbol text primary key,
  company_name text not null,
  sector text not null,
  exchange text not null,
  updated_at timestamptz not null default now(),
  constraint stocks_symbol_format check (symbol ~ '^[A-Z0-9]{2,10}$'),
  constraint stocks_exchange_check check (exchange in ('HOSE', 'HNX', 'UPCOM'))
);

create table public.price_history (
  id bigint generated always as identity primary key,
  symbol text not null references public.stocks(symbol) on update cascade on delete cascade,
  date date not null,
  open numeric(18, 4) not null,
  high numeric(18, 4) not null,
  low numeric(18, 4) not null,
  close numeric(18, 4) not null,
  volume bigint not null,
  constraint price_history_symbol_date_key unique (symbol, date),
  constraint price_history_prices_positive check (open >= 0 and high >= 0 and low >= 0 and close >= 0),
  constraint price_history_high_low_check check (high >= low),
  constraint price_history_volume_positive check (volume >= 0)
);

create table public.evidence_snapshots (
  id bigint generated always as identity primary key,
  symbol text not null references public.stocks(symbol) on update cascade on delete cascade,
  date date not null,
  signal_name text not null,
  signal_value numeric(18, 6) not null,
  signal_direction text not null,
  source text not null,
  created_at timestamptz not null default now(),
  constraint evidence_snapshots_direction_check check (signal_direction in ('supporting', 'contradicting')),
  constraint evidence_snapshots_symbol_date_signal_key unique (symbol, date, signal_name)
);

create table public.agent_analysis (
  id bigint generated always as identity primary key,
  symbol text not null references public.stocks(symbol) on update cascade on delete cascade,
  analysis_date date not null,
  bias text not null,
  bias_label text not null,
  summary_text text not null,
  key_levels_json jsonb not null default '{}'::jsonb,
  watch_for_text text not null,
  created_at timestamptz not null default now(),
  constraint agent_analysis_bias_check check (bias in ('bullish', 'neutral', 'bearish')),
  constraint agent_analysis_symbol_date_key unique (symbol, analysis_date),
  constraint agent_analysis_key_levels_object check (jsonb_typeof(key_levels_json) = 'object')
);

create table public.prediction_log (
  id bigint generated always as identity primary key,
  symbol text not null references public.stocks(symbol) on update cascade on delete cascade,
  prediction_date date not null,
  evidence_snapshot_id bigint not null references public.evidence_snapshots(id) on delete restrict,
  bias_at_prediction text not null,
  scenario_text text not null,
  target_check_date date not null,
  actual_return_pct numeric(12, 6),
  outcome_status text not null default 'pending',
  created_at timestamptz not null default now(),
  constraint prediction_log_bias_check check (bias_at_prediction in ('bullish', 'neutral', 'bearish')),
  constraint prediction_log_status_check check (outcome_status in ('pending', 'correct', 'incorrect', 'inconclusive')),
  constraint prediction_log_target_date_check check (target_check_date >= prediction_date)
);

create index price_history_symbol_date_idx on public.price_history (symbol, date desc);
create index evidence_snapshots_symbol_date_idx on public.evidence_snapshots (symbol, date desc);
create index agent_analysis_symbol_date_idx on public.agent_analysis (symbol, analysis_date desc);
create index prediction_log_symbol_date_idx on public.prediction_log (symbol, prediction_date desc);
create index prediction_log_evidence_snapshot_id_idx on public.prediction_log (evidence_snapshot_id);
create index prediction_log_status_target_date_idx on public.prediction_log (outcome_status, target_check_date);

alter table public.stocks enable row level security;
alter table public.price_history enable row level security;
alter table public.evidence_snapshots enable row level security;
alter table public.agent_analysis enable row level security;
alter table public.prediction_log enable row level security;

revoke all on table public.stocks, public.price_history, public.evidence_snapshots, public.agent_analysis, public.prediction_log from anon, authenticated;
grant select on table public.stocks, public.price_history, public.evidence_snapshots, public.agent_analysis, public.prediction_log to anon, authenticated;
grant all on table public.stocks, public.price_history, public.evidence_snapshots, public.agent_analysis, public.prediction_log to service_role;
grant usage, select on all sequences in schema public to service_role;

create policy "stocks are publicly readable by anon"
  on public.stocks for select to anon using (true);
create policy "stocks are publicly readable by authenticated users"
  on public.stocks for select to authenticated using (true);

create policy "price history is publicly readable by anon"
  on public.price_history for select to anon using (true);
create policy "price history is publicly readable by authenticated users"
  on public.price_history for select to authenticated using (true);

create policy "evidence snapshots are publicly readable by anon"
  on public.evidence_snapshots for select to anon using (true);
create policy "evidence snapshots are publicly readable by authenticated users"
  on public.evidence_snapshots for select to authenticated using (true);

create policy "agent analysis is publicly readable by anon"
  on public.agent_analysis for select to anon using (true);
create policy "agent analysis is publicly readable by authenticated users"
  on public.agent_analysis for select to authenticated using (true);

create policy "prediction log is publicly readable by anon"
  on public.prediction_log for select to anon using (true);
create policy "prediction log is publicly readable by authenticated users"
  on public.prediction_log for select to authenticated using (true);
