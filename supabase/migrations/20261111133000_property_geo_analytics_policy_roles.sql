begin;

drop policy if exists property_geo_analytics_admin_write on public.property_geo_analytics;

drop policy if exists property_geo_analytics_admin_insert on public.property_geo_analytics;
create policy property_geo_analytics_admin_insert on public.property_geo_analytics
  for insert to authenticated
  with check (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));

drop policy if exists property_geo_analytics_admin_update on public.property_geo_analytics;
create policy property_geo_analytics_admin_update on public.property_geo_analytics
  for update to authenticated
  using (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));

drop policy if exists property_geo_analytics_admin_delete on public.property_geo_analytics;
create policy property_geo_analytics_admin_delete on public.property_geo_analytics
  for delete to authenticated
  using (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));

commit;
