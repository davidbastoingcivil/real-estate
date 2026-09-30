-- Catálogo normalizado de tipos, enlazado con las 20 propiedades ya cargadas.
create table if not exists public.property_types (
  id text primary key,
  label text not null unique,
  description text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.property_types enable row level security;
grant select on public.property_types to anon, authenticated;
grant insert, update, delete on public.property_types to authenticated;

drop policy if exists "Property types are public" on public.property_types;
create policy "Property types are public" on public.property_types
  for select to anon, authenticated using (true);
drop policy if exists "Admins can add property types" on public.property_types;
create policy "Admins can add property types" on public.property_types
  for insert to authenticated
  with check (exists (select 1 from public.admin_users where user_id = (select auth.uid())));
drop policy if exists "Admins can edit property types" on public.property_types;
create policy "Admins can edit property types" on public.property_types
  for update to authenticated
  using (exists (select 1 from public.admin_users where user_id = (select auth.uid())))
  with check (exists (select 1 from public.admin_users where user_id = (select auth.uid())));
drop policy if exists "Admins can delete property types" on public.property_types;
create policy "Admins can delete property types" on public.property_types
  for delete to authenticated
  using (exists (select 1 from public.admin_users where user_id = (select auth.uid())));

insert into public.property_types (id, label, description, sort_order) values
  ('casa', 'Casa', 'Viviendas unifamiliares, familiares y campestres.', 1),
  ('apartamento', 'Apartamento', 'Apartamentos, apartaestudios, lofts, dúplex y penthouses.', 2),
  ('villa', 'Villa', 'Villas y casas de descanso de formato amplio.', 3),
  ('lote', 'Lote', 'Terrenos para desarrollo residencial o comercial.', 4),
  ('comercial', 'Comercial', 'Locales y espacios para actividad comercial.', 5)
on conflict (id) do update
set label = excluded.label, description = excluded.description, sort_order = excluded.sort_order;

alter table public.properties add column if not exists category_id text;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'properties_category_id_fkey'
      and conrelid = 'public.properties'::regclass
  ) then
    alter table public.properties
      add constraint properties_category_id_fkey
      foreign key (category_id) references public.property_types(id)
      on update cascade on delete restrict;
  end if;
end
$$;

update public.properties p
set category_id = pt.id
from public.property_types pt
where lower(p.type) = lower(pt.label);

create index if not exists properties_category_id_idx
  on public.properties(category_id);

create or replace function public.sync_property_category_id()
returns trigger
language plpgsql
set search_path = public
as $$
declare resolved_category text;
begin
  select id into resolved_category
  from public.property_types
  where lower(label) = lower(new.type);

  if resolved_category is null then
    raise exception 'Tipo de inmueble no registrado: %', coalesce(new.type, '(vacío)');
  end if;

  new.category_id := resolved_category;
  return new;
end;
$$;

drop trigger if exists properties_sync_category_id on public.properties;
create trigger properties_sync_category_id
before insert or update of type on public.properties
for each row execute function public.sync_property_category_id();

alter table public.properties alter column category_id set not null;

grant select on public.properties to anon, authenticated;
grant insert, update, delete on public.properties to authenticated;

drop policy if exists "Published property catalog is public" on public.properties;
create policy "Published property catalog is public" on public.properties
  for select to anon, authenticated using (true);
drop policy if exists "Admins can add properties" on public.properties;
create policy "Admins can add properties" on public.properties
  for insert to authenticated
  with check (exists (select 1 from public.admin_users where user_id = (select auth.uid())));
drop policy if exists "Admins can edit properties" on public.properties;
create policy "Admins can edit properties" on public.properties
  for update to authenticated
  using (exists (select 1 from public.admin_users where user_id = (select auth.uid())))
  with check (exists (select 1 from public.admin_users where user_id = (select auth.uid())));
drop policy if exists "Admins can delete properties" on public.properties;
create policy "Admins can delete properties" on public.properties
  for delete to authenticated
  using (exists (select 1 from public.admin_users where user_id = (select auth.uid())));

