-- Keep the existing read-only comparable RPC compatible with PostgreSQL.
-- Postgres has round(numeric, integer), but no round(double precision, integer).
create or replace function public.get_unified_comparables(
  target_lat double precision,
  target_lng double precision,
  radius double precision,
  p_type text,
  p_area double precision
)
returns table (
  id text, title text, price numeric, area_m2 numeric, price_per_m2 numeric,
  distance_meters numeric, stratum integer, rooms integer, bathrooms integer,
  similarity_score numeric, source_kind text, source_portal text, source_url text, location_precision text
)
language plpgsql stable security definer
set search_path = extensions, pg_catalog
as $$
declare origin extensions.geography(Point, 4326);
begin
  if target_lat is null or target_lng is null or target_lat not between -90 and 90
     or target_lng not between -180 and 180 or (target_lat = 0 and target_lng = 0)
     or radius is null or radius < 100 or radius > 15000
     or p_type is null or btrim(p_type) = '' or p_area is null or p_area <= 0 then
    raise exception 'Ubicación, radio, tipo y área deben ser válidos.' using errcode = '22023';
  end if;
  origin := extensions.st_setsrid(extensions.st_makepoint(target_lng, target_lat), 4326)::extensions.geography;

  return query
  with candidates as (
    select p.id::text id, p.title::text title, p.price::numeric price, p.area::numeric area_m2,
      round((p.price / nullif(p.area, 0))::numeric, 2) price_per_m2,
      extensions.st_distance(p.coordinates, origin)::numeric distance_meters,
      null::integer stratum, p.bedrooms::integer rooms, p.bathrooms::integer bathrooms,
      'properties'::text source_kind, null::text source_portal, null::text source_url, 'stored'::text location_precision
    from public.properties p
    where p.is_published and lower(p.status) not like '%vendido%'
      and lower(p.type) = lower(p_type) and p.price > 0 and p.area > 0
      and p.coordinates is not null and p.area between p_area * 0.8 and p_area * 1.2
      and extensions.st_dwithin(p.coordinates, origin, radius)
    union all
    select m.id::text, m.title, m.price, m.area_m2, m.price_per_m2,
      extensions.st_distance(m.location, origin)::numeric,
      m.stratum, m.rooms, m.bathrooms, 'market_comparables'::text,
      m.source_portal, m.source_url, m.location_precision
    from public.market_comparables m
    where lower(m.property_type) = lower(p_type)
      and m.area_m2 between p_area * 0.8 and p_area * 1.2
      and extensions.st_dwithin(m.location, origin, radius)
  )
  select c.id, c.title, c.price, c.area_m2, c.price_per_m2, c.distance_meters,
    c.stratum, c.rooms, c.bathrooms,
    round((greatest(0, 100 - abs(c.area_m2 - p_area) / p_area * 100
      - least(25, c.distance_meters / radius * 25))::numeric), 2),
    c.source_kind, c.source_portal, c.source_url, c.location_precision
  from candidates c
  order by c.distance_meters asc
  limit 50;
end;
$$;

revoke all on function public.get_unified_comparables(double precision, double precision, double precision, text, double precision) from public;
grant execute on function public.get_unified_comparables(double precision, double precision, double precision, text, double precision) to anon, authenticated;
