-- Index the creator reference used by physician-only history queries.
create index if not exists calculator_results_created_by_idx
  on public.calculator_results (created_by);
