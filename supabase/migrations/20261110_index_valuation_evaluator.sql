-- Index the evaluator foreign key to keep admin history and deletion checks efficient.
create index if not exists property_valuations_evaluator_user_id_idx
  on public.property_valuations(evaluator_user_id)
  where evaluator_user_id is not null;
