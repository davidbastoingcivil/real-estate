-- Mantiene el esquema tabular del catálogo y agrega los campos de presentación
-- que la aplicación y el panel de administración necesitan.
alter table public.properties
  add column if not exists municipality text not null default '',
  add column if not exists "ubicación" text not null default '',
  add column if not exists categories text[] not null default '{}',
  add column if not exists payment text[] not null default '{}',
  add column if not exists featured boolean not null default false,
  add column if not exists is_published boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

update public.properties
set municipality = nullif(trim(split_part(location, ',', 1)), ''),
    "ubicación" = nullif(trim(split_part(location, ',', 2)), ''),
    categories = case
      when type = 'Comercial' then array['Buy', 'Commercial']::text[]
      when slug = 'condominio-bambu-carmen-de-apicala' then array['Buy', 'Projects']::text[]
      when status ilike '%arriendo%' then array['Rent']::text[]
      else array['Buy']::text[]
    end,
    payment = case
      when slug = 'condominio-bambu-carmen-de-apicala' then array[
        '30% de cuota inicial',
        'Pagos mensuales según certificación de avance de obra',
        'Esquema transparente y seguro'
      ]::text[]
      else coalesce(payment, '{}'::text[])
    end,
    featured = slug = 'condominio-bambu-carmen-de-apicala',
    updated_at = coalesce(created_at, now());
