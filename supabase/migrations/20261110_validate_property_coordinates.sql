-- Keep stored latitude/longitude within WGS84 ranges for mapping and reports.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'properties_lat_wgs84_range') then
    alter table public.properties add constraint properties_lat_wgs84_range
      check (lat is null or lat between -90 and 90);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'properties_lng_wgs84_range') then
    alter table public.properties add constraint properties_lng_wgs84_range
      check (lng is null or lng between -180 and 180);
  end if;
end $$;
