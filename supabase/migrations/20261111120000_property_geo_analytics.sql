-- Persistent, property-scoped cache for sourced territorial data.
begin;

create schema if not exists extensions;
create extension if not exists postgis with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.property_geo_analytics (
  id uuid primary key default gen_random_uuid(),
  property_id integer not null unique references public.properties(id) on delete cascade,
  coordinates extensions.geography(Point, 4326),
  accessibility jsonb not null default '{}'::jsonb,
  pois jsonb not null default '{}'::jsonb,
  urban_norm jsonb not null default '{}'::jsonb,
  search_radius_m integer not null default 1000 check (search_radius_m between 100 and 5000),
  source_name text,
  source_updated_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'ready', 'unavailable')),
  updated_at timestamptz not null default now()
);

create index if not exists property_geo_analytics_coordinates_gist_idx
  on public.property_geo_analytics using gist (coordinates);
create index if not exists property_geo_analytics_updated_at_idx
  on public.property_geo_analytics (updated_at desc);

alter table public.property_geo_analytics enable row level security;
revoke all on public.property_geo_analytics from anon, authenticated;
grant select on public.property_geo_analytics to anon, authenticated;
grant insert, update, delete on public.property_geo_analytics to authenticated;

drop policy if exists property_geo_analytics_public_read on public.property_geo_analytics;
create policy property_geo_analytics_public_read on public.property_geo_analytics
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.properties p
      where p.id = property_id and p.is_published = true
    )
    or exists (
      select 1 from public.admin_users a
      where a.user_id = (select auth.uid())
    )
  );

drop policy if exists property_geo_analytics_admin_write on public.property_geo_analytics;
create policy property_geo_analytics_admin_write on public.property_geo_analytics
  for all to authenticated
  using (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));

-- Keep known property metadata in the cache and invalidate exact point data
-- whenever the coordinates change. No estimated POIs or zoning are inserted.
create or replace function private.sync_property_geo_analytics()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  point_changed boolean := tg_op = 'INSERT';
begin
  if tg_op = 'UPDATE' then
    point_changed := new.lat is distinct from old.lat or new.lng is distinct from old.lng;
  end if;
  insert into public.property_geo_analytics (
    property_id, coordinates, accessibility, pois, urban_norm,
    search_radius_m, source_name, source_updated_at, status, updated_at
  ) values (
    new.id,
    case when new.lat between -90 and 90 and new.lng between -180 and 180
      and not (new.lat = 0 and new.lng = 0)
      then extensions.st_setsrid(extensions.st_makepoint(new.lng::double precision, new.lat::double precision), 4326)::extensions.geography
      else null end,
    '{}'::jsonb,
    '{}'::jsonb,
    jsonb_build_object(
      'municipality', nullif(new.municipality, ''),
      'municipality_code', nullif(new.municipality_code, ''),
      'department', nullif(new."ubicación", ''),
      'registered_stratum', new.stratum,
      'source', 'property_record',
      'status', case when new.municipality_code is not null or new.stratum is not null then 'registered_property_data' else 'not_available' end
    ),
    1000,
    null,
    null,
    'pending',
    now()
  )
  on conflict (property_id) do update set
    coordinates = excluded.coordinates,
    accessibility = case when point_changed then '{}'::jsonb else public.property_geo_analytics.accessibility end,
    pois = case when point_changed then '{}'::jsonb else public.property_geo_analytics.pois end,
    urban_norm = excluded.urban_norm,
    source_name = case when point_changed then null else public.property_geo_analytics.source_name end,
    source_updated_at = case when point_changed then null else public.property_geo_analytics.source_updated_at end,
    status = case when point_changed then 'pending' else public.property_geo_analytics.status end,
    updated_at = case when point_changed then now() else public.property_geo_analytics.updated_at end;
  return new;
end;
$$;

revoke all on function private.sync_property_geo_analytics() from public, anon, authenticated;
drop trigger if exists properties_geo_analytics_sync on public.properties;
create trigger properties_geo_analytics_sync
after insert or update of lat, lng, municipality, municipality_code, stratum, "ubicación"
on public.properties
for each row execute function private.sync_property_geo_analytics();

insert into public.property_geo_analytics (property_id, coordinates, urban_norm, status)
select p.id,
  case when p.lat between -90 and 90 and p.lng between -180 and 180 and not (p.lat = 0 and p.lng = 0)
    then extensions.st_setsrid(extensions.st_makepoint(p.lng::double precision, p.lat::double precision), 4326)::extensions.geography
    else null end,
  jsonb_build_object(
    'municipality', nullif(p.municipality, ''),
    'municipality_code', nullif(p.municipality_code, ''),
    'department', nullif(p."ubicación", ''),
    'registered_stratum', p.stratum,
    'source', 'property_record',
    'status', case when p.municipality_code is not null or p.stratum is not null then 'registered_property_data' else 'not_available' end
  ),
  'pending'
from public.properties p
on conflict (property_id) do nothing;

commit;
