-- Configure the existing public media bucket for property photos and videos.
-- Keeps objects publicly readable while restricting writes to admin_users.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'property-images',
  'property-images',
  true,
  52428800,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif',
    'video/mp4', 'video/webm', 'video/quicktime'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Property photos can be viewed publicly" on storage.objects;
create policy "Property photos and videos can be viewed publicly"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'property-images');

drop policy if exists "Admins can upload property photos" on storage.objects;
drop policy if exists "Admins can upload property media" on storage.objects;
create policy "Admins can upload property media"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'property-images'
    and exists (select 1 from public.admin_users where user_id = (select auth.uid()))
  );

drop policy if exists "Admins can replace property photos" on storage.objects;
drop policy if exists "Admins can replace property media" on storage.objects;
create policy "Admins can replace property media"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'property-images'
    and exists (select 1 from public.admin_users where user_id = (select auth.uid()))
  )
  with check (
    bucket_id = 'property-images'
    and exists (select 1 from public.admin_users where user_id = (select auth.uid()))
  );

drop policy if exists "Admins can remove property photos" on storage.objects;
drop policy if exists "Admins can remove property media" on storage.objects;
create policy "Admins can remove property media"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'property-images'
    and exists (select 1 from public.admin_users where user_id = (select auth.uid()))
  );
