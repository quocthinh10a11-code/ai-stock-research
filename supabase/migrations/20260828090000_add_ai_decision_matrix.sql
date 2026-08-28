-- Structured AI indicator-to-decision output. Public read follows the parent table's RLS.
alter table public.ai_research_reports
  add column if not exists decision_matrix_json jsonb not null default '[]'::jsonb;

alter table public.ai_research_reports
  drop constraint if exists ai_research_decision_matrix_array;

alter table public.ai_research_reports
  add constraint ai_research_decision_matrix_array
  check (jsonb_typeof(decision_matrix_json) = 'array');
