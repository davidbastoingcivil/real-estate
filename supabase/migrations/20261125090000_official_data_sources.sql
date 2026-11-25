-- Track where official parcel data came from (Croma/IGAC or an imported
-- Catastro Bogotá file) and only invalidate the cache when inputs really change.
begin;

alter table public.property_official_data add column if not exists source text not null default 'croma'
  check (source in ('croma', 'catastro_bogota'));
alter table public.property_official_data add column if not exists details jsonb not null default '{}'::jsonb;

alter table public.property_official_data drop constraint if exists property_official_data_lookup_method_check;
alter table public.property_official_data add constraint property_official_data_lookup_method_check
  check (lookup_method in ('cadastral_id', 'coordinates', 'import', 'none'));

-- The admin form writes every column on save; fire only on real changes.
drop trigger if exists properties_official_data_invalidate on public.properties;
drop trigger if exists properties_official_data_invalidate_insert on public.properties;
drop trigger if exists properties_official_data_invalidate_update on public.properties;
create trigger properties_official_data_invalidate_insert
after insert on public.properties
for each row execute function private.invalidate_property_official_data();
create trigger properties_official_data_invalidate_update
after update of lat, lng, cadastral_id, national_cadastral_number, chip, municipality, municipality_code
on public.properties
for each row
when (
  old.lat is distinct from new.lat or old.lng is distinct from new.lng
  or old.cadastral_id is distinct from new.cadastral_id
  or old.national_cadastral_number is distinct from new.national_cadastral_number
  or old.chip is distinct from new.chip
  or old.municipality is distinct from new.municipality
  or old.municipality_code is distinct from new.municipality_code
)
execute function private.invalidate_property_official_data();

commit;
