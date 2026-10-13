-- Additive AVM schema. Existing public.properties rows and columns are preserved.
begin;

alter table public.properties
  add column if not exists coordinates extensions.geography(Point, 4326);

create or replace function public.sync_property_coordinates()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.lat is null or new.lng is null or new.lat not between -90 and 90
     or new.lng not between -180 and 180 or (new.lat = 0 and new.lng = 0) then
    new.coordinates := null;
  else
    new.coordinates := extensions.st_setsrid(
      extensions.st_makepoint(new.lng::double precision, new.lat::double precision), 4326
    )::extensions.geography;
  end if;
  return new;
end;
$$;

update public.properties
set coordinates = case
  when lat between -90 and 90 and lng between -180 and 180 and not (lat = 0 and lng = 0)
    then extensions.st_setsrid(extensions.st_makepoint(lng::double precision, lat::double precision), 4326)::extensions.geography
  else null
end
where coordinates is null;

drop trigger if exists properties_sync_coordinates on public.properties;
create trigger properties_sync_coordinates
before insert or update of lat, lng on public.properties
for each row execute function public.sync_property_coordinates();

create index if not exists properties_coordinates_gist_idx
  on public.properties using gist (coordinates);
create index if not exists properties_avm_lookup_idx
  on public.properties (lower(type), is_published, price, area);

create table if not exists public.property_valuations (
  id uuid primary key default gen_random_uuid(),
  property_id bigint not null references public.properties(id) on delete cascade,
  valuation_date timestamptz not null default now(),
  estimated_value numeric(16,2) not null check (estimated_value >= 0),
  value_per_m2 numeric(16,2) not null check (value_per_m2 >= 0),
  value_min numeric(16,2) not null check (value_min >= 0),
  value_max numeric(16,2) not null check (value_max >= value_min),
  confidence_score numeric(5,2) not null check (confidence_score between 0 and 100),
  estimated_rent numeric(16,2) not null check (estimated_rent >= 0),
  cap_rate numeric(7,4) not null check (cap_rate >= 0),
  valuation_data_json jsonb not null default '{}'::jsonb,
  evaluator_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists property_valuations_property_date_idx
  on public.property_valuations (property_id, valuation_date desc);

alter table public.property_valuations enable row level security;
revoke all on public.property_valuations from anon, authenticated;
grant select, insert on public.property_valuations to authenticated;

drop policy if exists "Admins can read valuations" on public.property_valuations;
create policy "Admins can read valuations" on public.property_valuations
  for select to authenticated
  using (exists (select 1 from public.admin_users where user_id = (select auth.uid())));
drop policy if exists "Admins can save valuations" on public.property_valuations;
create policy "Admins can save valuations" on public.property_valuations
  for insert to authenticated
  with check (
    evaluator_user_id = (select auth.uid())
    and exists (select 1 from public.admin_users where user_id = (select auth.uid()))
  );

create or replace function public.get_avm_comparables(
  target_lat double precision,
  target_lng double precision,
  target_type text,
  target_area numeric,
  max_distance_meters integer default 1500,
  limit_count integer default 10,
  target_property_id bigint default null
)
returns table (
  id bigint,
  title text,
  price numeric,
  area_m2 numeric,
  price_per_m2 numeric,
  distance_meters numeric,
  stratum integer,
  rooms integer,
  bathrooms integer,
  similarity_score numeric
)
language plpgsql
stable
security definer
set search_path = extensions, pg_catalog
as $$
declare
  origin extensions.geography(Point, 4326);
  safe_radius integer := coalesce(max_distance_meters, 1500);
  safe_limit integer := coalesce(limit_count, 10);
begin
  if target_lat is null or target_lng is null or target_lat not between -90 and 90
     or target_lng not between -180 and 180 or (target_lat = 0 and target_lng = 0)
     or target_type is null or btrim(target_type) = '' or target_area is null or target_area <= 0 then
    raise exception 'A valid location, property type and area are required.' using errcode = '22023';
  end if;
  if safe_radius < 100 or safe_radius > 15000 or safe_limit < 1 or safe_limit > 25 then
    raise exception 'Radius must be 100-15000 m and limit_count must be 1-25.' using errcode = '22023';
  end if;

  origin := extensions.st_setsrid(extensions.st_makepoint(target_lng, target_lat), 4326)::extensions.geography;
  return query
  select p.id::bigint, p.title::text, p.price::numeric, p.area::numeric,
    round(p.price / nullif(p.area, 0), 2)::numeric,
    round(extensions.st_distance(p.coordinates, origin)::numeric, 1)::numeric,
    null::integer, p.bedrooms::integer, p.bathrooms::integer,
    round(greatest(0, 100 - abs(p.area - target_area) / target_area * 100
      - least(25, extensions.st_distance(p.coordinates, origin)::numeric / safe_radius * 25)), 2)::numeric
  from public.properties p
  where p.is_published = true
    and lower(p.status) not like '%vendido%'
    and lower(p.type) = lower(target_type)
    and p.price > 0 and p.area > 0 and p.coordinates is not null
    and p.area between target_area * 0.8 and target_area * 1.2
    and (target_property_id is null or p.id <> target_property_id)
    and extensions.st_dwithin(p.coordinates, origin, safe_radius)
  order by p.coordinates OPERATOR(extensions.<->) origin
  limit safe_limit;
end;
$$;

revoke all on function public.get_avm_comparables(double precision, double precision, text, numeric, integer, integer, bigint) from public;
grant execute on function public.get_avm_comparables(double precision, double precision, text, numeric, integer, integer, bigint) to anon, authenticated;

commit;
