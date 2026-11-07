alter table public.properties
  add column if not exists deposits integer not null default 0,
  add column if not exists chip varchar(40),
  add column if not exists national_cadastral_number varchar(30),
  add column if not exists real_estate_registration varchar(40),
  add column if not exists stratum smallint,
  add column if not exists cadastral_appraisal numeric(16,2),
  add column if not exists official_lot_area numeric(10,2),
  add column if not exists official_built_area numeric(10,2);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'properties_national_cadastral_number_30_digits') then
    alter table public.properties add constraint properties_national_cadastral_number_30_digits
      check (national_cadastral_number is null or national_cadastral_number ~ '^\d{30}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'properties_stratum_range') then
    alter table public.properties add constraint properties_stratum_range check (stratum is null or stratum between 0 and 6);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'properties_nonnegative_official_values') then
    alter table public.properties add constraint properties_nonnegative_official_values
      check ((deposits >= 0) and (cadastral_appraisal is null or cadastral_appraisal >= 0)
        and (official_lot_area is null or official_lot_area >= 0)
        and (official_built_area is null or official_built_area >= 0));
  end if;
end $$;