-- 2026-11-25 · Demo catalogue adjustments (applied).
-- 1. Property 1 carried a promotional "FEATURED PROPERTIES" collage (Drive link and a
--    Storage copy) as if it were its photo. Removed so reports only show listing photos.
update public.properties set images = array_remove(images, 'https://drive.google.com/file/d/1IwmV66PmpjORCqKjnPIZV1NnzAtEn7XK/view?usp=drive_link') where id = 1;
update public.properties set images = array_remove(images, 'https://cnpfzscaoclvektgqrzb.supabase.co/storage/v1/object/public/property-images/properties/5336a465-81be-4ee1-8d76-6ee00c93050c.jpg') where id = 1;
-- 2. Property 21 (Toberín, Bogotá) received the sample Catastro Bogotá export
--    (CHIP AAA0118ECFT, KR 46 165 75, Britalia) through the same fields the admin
--    import fills: chip, cadastral_id, national_cadastral_number, official areas and
--    property_official_data (source = 'catastro_bogota').
