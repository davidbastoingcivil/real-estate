-- Additive spatial support for property discovery. Existing property data and columns are preserved.
create schema if not exists extensions;
create extension if not exists postgis with schema extensions;

alter table public.properties
  add column if not exists coordinates extensions.geography(Point, 4326);

create or replace function public.sync_property_coordinates()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.lat is null or new.lng is null or new.lat < -90 or new.lat > 90 or new.lng < -180 or new.lng > 180 then
    new.coordinates := null;
  else
    new.coordinates := extensions.st_geogfromtext(format('SRID=4326;POINT(%s %s)', new.lng, new.lat));
  end if;
  return new;
end;
$$;

drop trigger if exists properties_sync_coordinates on public.properties;
create trigger properties_sync_coordinates
before insert or update of lat, lng on public.properties
for each row execute function public.sync_property_coordinates();

update public.properties
set coordinates = extensions.st_geogfromtext(format('SRID=4326;POINT(%s %s)', lng, lat))
where coordinates is null
  and lat between -90 and 90
  and lng between -180 and 180;

create index if not exists properties_coordinates_gist_idx
  on public.properties using gist (coordinates);

create or replace function public.get_properties_in_bounds_v2(
  bounds_wkt text,
  limit_count integer default 500
)
returns table (
  id bigint,
  title text,
  slug text,
  price numeric,
  type text,
  area numeric,
  bedrooms integer,
  bathrooms integer,
  location text,
  lat numeric,
  lng numeric,
  status text,
  image text
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  safe_limit integer := least(greatest(coalesce(limit_count, 500), 1), 500);
  search_bounds extensions.geography;
begin
  if bounds_wkt is null or length(bounds_wkt) > 2000 or bounds_wkt not ilike 'POLYGON((%' then
    raise exception 'Bounds must be a valid WKT polygon.' using errcode = '22023';
  end if;

  search_bounds := extensions.st_geogfromtext(bounds_wkt);

  return query
  select p.id::bigint, p.title, p.slug, p.price, p.type, p.area,
         p.bedrooms::integer, p.bathrooms::integer, p.location, p.lat, p.lng,
         p.status, p.images[1]
  from public.properties as p
  where p.coordinates is not null
    and extensions.st_intersects(p.coordinates, search_bounds)
  order by p.id desc
  limit safe_limit;
end;
$$;

revoke all on function public.get_properties_in_bounds_v2(text, integer) from public;
grant execute on function public.get_properties_in_bounds_v2(text, integer) to anon, authenticated;
