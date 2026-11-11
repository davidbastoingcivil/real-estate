-- Avoid overlapping permissive SELECT rules while preserving public and admin behavior.
begin;

drop policy if exists "Public can read published properties" on public.properties;
drop policy if exists "Admins can read all properties" on public.properties;
drop policy if exists "Authenticated users can read published properties; admins can read all" on public.properties;

create policy "Public can read published properties" on public.properties
  for select to anon
  using (is_published = true);

create policy "Authenticated users can read published properties; admins can read all" on public.properties
  for select to authenticated
  using (is_published = true or exists (
    select 1 from public.admin_users where user_id = (select auth.uid())
  ));

commit;
