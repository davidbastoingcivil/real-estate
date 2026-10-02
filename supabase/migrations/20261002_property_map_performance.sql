-- Optional additive map RPC for bounded, predictable spatial queries.
-- Preserves public.properties and all existing property records.
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
  select p.id, p.title, p.slug, p.price, p.type, p.area, p.bedrooms, p.bathrooms,
         p.location, p.lat, p.lng, p.status, p.images[1]
  from public.properties as p
  where p.coordinates is not null
    and extensions.st_intersects(p.coordinates, search_bounds)
  order by p.id desc
  limit safe_limit;
end;
$$;

revoke all on function public.get_properties_in_bounds_v2(text, integer) from public;
grant execute on function public.get_properties_in_bounds_v2(text, integer) to anon, authenticated;
