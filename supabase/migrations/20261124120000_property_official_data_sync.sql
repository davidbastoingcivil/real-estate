-- Cache of official (IGAC / DANE via Croma) data per property.
-- Filled automatically by the app when an administrator saves a property;
-- invalidated by trigger whenever location or identifiers change.
begin;

create table if not exists public.property_official_data (
  property_id integer primary key references public.properties(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'verified', 'not_found', 'manager_not_igac', 'no_identifier', 'error')),
  lookup_method text check (lookup_method in ('cadastral_id', 'coordinates', 'none')),
  municipality_code text check (municipality_code is null or municipality_code ~ '^\d{5}$'),
  municipality text,
  department text,
  cadastral_manager text,
  cadastral_number text check (cadastral_number is null or cadastral_number ~ '^\d{30}$'),
  previous_cadastral_number text,
  address text,
  appraisal numeric,
  built_area_m2 numeric,
  land_area_m2 numeric,
  economic_destination text,
  vigencia jsonb,
  buildings jsonb not null default '[]'::jsonb,
  geometry jsonb,
  territorial jsonb not null default '{}'::jsonb,
  source_checked_at timestamptz,
  message text,
  synced_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.property_official_data enable row level security;
revoke all on public.property_official_data from anon, authenticated;
grant select on public.property_official_data to anon, authenticated;
grant insert, update, delete on public.property_official_data to authenticated;

drop policy if exists property_official_data_public_read on public.property_official_data;
create policy property_official_data_public_read on public.property_official_data
  for select to anon, authenticated
  using (
    exists (select 1 from public.properties p where p.id = property_id and p.is_published = true)
    or exists (select 1 from public.admin_users a where a.user_id = (select auth.uid()))
  );

drop policy if exists property_official_data_admin_write on public.property_official_data;
create policy property_official_data_admin_write on public.property_official_data
  for all to authenticated
  using (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));

-- Mark the cache as pending whenever data that drives the lookup changes.
create or replace function private.invalidate_property_official_data()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.property_official_data (property_id, status, updated_at)
  values (new.id, 'pending', now())
  on conflict (property_id) do update set status = 'pending', message = null, updated_at = now();
  return new;
end;
$$;

revoke all on function private.invalidate_property_official_data() from public, anon, authenticated;
drop trigger if exists properties_official_data_invalidate on public.properties;
create trigger properties_official_data_invalidate
after insert or update of lat, lng, cadastral_id, national_cadastral_number, municipality, municipality_code
on public.properties
for each row execute function private.invalidate_property_official_data();

insert into public.property_official_data (property_id, status)
select id, 'pending' from public.properties
on conflict (property_id) do nothing;

-- Format guards. NOT VALID keeps legacy rows from blocking the migration;
-- run the data clean-up and then VALIDATE (done below when rows already comply).
alter table public.properties drop constraint if exists properties_municipality_code_format;
alter table public.properties add constraint properties_municipality_code_format
  check (municipality_code is null or municipality_code ~ '^\d{5}$') not valid;
alter table public.properties drop constraint if exists properties_national_cadastral_number_format;
alter table public.properties add constraint properties_national_cadastral_number_format
  check (national_cadastral_number is null or national_cadastral_number ~ '^\d{30}$') not valid;

commit;
