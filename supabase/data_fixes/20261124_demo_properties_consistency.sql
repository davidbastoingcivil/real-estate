-- Demo catalogue clean-up (fictitious listings). Applied 2026-11-24.
-- Makes location data consistent so automatic Croma/DANE/IGAC sync works.
-- Replace with the real data of each property when it enters the catalogue.
begin;

-- Bogotá D.C. (catastro: UAECD, not IGAC)
update public.properties
set municipality = 'Bogotá D.C.', municipality_code = '11001', "ubicación" = 'Bogotá D.C.'
where id in (2, 4, 7, 9, 12, 14, 16, 20, 21);

-- Tunja (catastro: Municipio de Tunja, gestor propio)
update public.properties
set municipality = 'Tunja', municipality_code = '15001', "ubicación" = 'Boyacá'
where id in (3, 6, 10, 11, 15, 18);

-- Carmen de Apicalá. The previous points fell on rural farms of Melgar (73449);
-- they are moved to verified points inside Carmen de Apicalá (IGAC catastro).
update public.properties set municipality = 'Carmen de Apicalá', municipality_code = '73148', "ubicación" = 'Tolima'
where id in (1, 5, 8, 13, 17, 19);
update public.properties set lat = 4.148000, lng = -74.720000 where id = 1;
update public.properties set lat = 4.150000, lng = -74.718000 where id = 5;
update public.properties set lat = 4.154000, lng = -74.721500 where id = 8;
update public.properties set lat = 4.150000, lng = -74.716500 where id = 13;
update public.properties set lat = 4.150000, lng = -74.721500 where id = 17;
update public.properties set lat = 4.154000, lng = -74.718000 where id = 19;

-- Invalid fictitious identifiers / "official" values not backed by a source.
update public.properties
set cadastral_id = null, national_cadastral_number = null,
    cadastral_appraisal = null, official_lot_area = null, official_built_area = null
where id in (1, 21);

alter table public.properties validate constraint properties_municipality_code_format;
alter table public.properties validate constraint properties_national_cadastral_number_format;

commit;
