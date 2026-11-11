-- Public visitors may read published inventory only; administrators keep full CMS access.
begin;

drop policy if exists "Published property catalog is public" on public.properties;
drop policy if exists "Public can read published properties" on public.properties;
drop policy if exists "Admins can read all properties" on public.properties;

create policy "Public can read published properties" on public.properties
  for select to anon, authenticated
  using (is_published = true);

create policy "Admins can read all properties" on public.properties
  for select to authenticated
  using (exists (
    select 1 from public.admin_users
    where user_id = (select auth.uid())
  ));

commit;
