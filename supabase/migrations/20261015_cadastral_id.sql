-- Adición no destructiva para registrar el identificador catastral administrativamente.
alter table public.properties
  add column if not exists cadastral_id varchar(50);

create index if not exists idx_properties_cadastral_id
  on public.properties (cadastral_id)
  where cadastral_id is not null;
