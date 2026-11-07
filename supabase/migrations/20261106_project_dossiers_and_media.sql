-- Project-specific dossier data and separately managed audio/video assets.
alter table public.properties
  add column if not exists property_code text,
  add column if not exists periodicity text not null default 'Único',
  add column if not exists garage_spaces integer not null default 0,
  add column if not exists audio_tours jsonb not null default '[]'::jsonb,
  add column if not exists video_presentations jsonb not null default '[]'::jsonb,
  add column if not exists dossier jsonb not null default '{}'::jsonb;

create unique index if not exists properties_property_code_unique
  on public.properties(property_code) where property_code is not null and property_code <> '';

-- The attached Condominio Bambú brochure lists a $390M sale price.
update public.properties
set price = 390000000,
    property_code = coalesce(nullif(property_code, ''), 'DBRE-BAMBU'),
    periodicity = 'Único',
    garage_spaces = greatest(garage_spaces, 1),
    bedrooms = 3,
    bathrooms = 2,
    area = 144,
    dossier = '{"developer":"RB Construction","tagline":"Tu nuevo hogar o inversión en Carmen de Apicalá","description":"Vivienda campestre lista para habitar o arrendar en un entorno natural, privado y de clima cálido.","brochurePrice":390000000,"travelTime":"2 h 30 desde Bogotá","sections":[{"title":"Nivel 1 · Primer piso","description":"Espacios amplios y luminosos que conectan sala, comedor y cocina con un jardín interior.","items":["Ingreso amplio","Sala con zona de televisión","Jardín interior","Comedor para seis personas","Cocina","Parqueadero privado para un vehículo","Baño social y zona de lavandería"]},{"title":"Nivel 2 · Segundo piso","description":"Zona privada de descanso con tres habitaciones y balcón.","items":["Tres habitaciones con ventilador de techo","Dos baños completos con ducha","Balcón con zona de estar","Doble altura con cubierta de vidrio y vegetación"]},{"title":"Terraza social","description":"Un espacio al aire libre para descansar y recibir.","items":["Jacuzzi con deck de madera","Zona de asoleadoras y sombrilla","Hamaca y rincón de lectura","Sala exterior y comedor","Zona de parrilla y barra"]},{"title":"Servicios y acabados","items":["Tanque subterráneo de reserva de agua de 2.000 L","Tanque cubierto de reserva de agua de 1.000 L","Ducha con vidrio y revestimiento decorativo","Mesón en piedra y espejo con iluminación","Grifería dorada y nichos iluminados"]}]}'::jsonb,
    updated_at = now()
where slug = 'condominio-bambu-carmen-de-apicala';

-- Audio/video uploads use the same private admin / public read Storage policies.
update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','image/avif','image/gif','video/mp4','video/webm','video/quicktime','audio/mpeg','audio/mp3']
where id = 'property-images';

alter table public.leads
  add column if not exists lead_type text not null default 'property_inquiry',
  add column if not exists details text not null default '',
  add column if not exists consent_accepted boolean not null default false,
  add column if not exists consent_version text not null default '';

revoke all on public.leads from anon, authenticated;
grant insert (name, phone_number, interested_property_id, lead_type, details, consent_accepted, consent_version)
  on public.leads to anon, authenticated;
grant select on public.leads to authenticated;

drop policy if exists "Public can submit a lead" on public.leads;
create policy "Public can submit a lead" on public.leads
  for insert to anon, authenticated
  with check (
    length(btrim(name)) between 2 and 100
    and length(regexp_replace(phone_number, '[^0-9]', '', 'g')) between 7 and 15
    and lead_type in ('property_inquiry', 'sell_property', 'rent_property')
    and consent_accepted = true
    and length(details) <= 2000
  );
