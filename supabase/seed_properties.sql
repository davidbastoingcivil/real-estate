WITH imported AS (
INSERT INTO public.properties (
  title, 
  slug, 
  description, 
  price, 
  location, 
  lat, 
  lng, 
  bedrooms, 
  bathrooms, 
  area, 
  type, 
  status, 
  images, 
  features
) VALUES 
(
  'Condominio Bambú - Casa Moderna',
  'condominio-bambu-carmen-de-apicala',
  'Espectacular casa campestre de diseño moderno con 144 m² más terraza, clima cálido todo el año, piscina privada en el condominio y alta valorización.',
  340000000,
  'Carmen de Apicalá, Tolima',
  4.2045, -74.7297,
  3, 2, 144,
  'Casa', 'En Venta',
  ARRAY['https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&q=80'],
  ARRAY['Piscina', 'Clima Cálido', 'Terraza Panorámica', 'Seguridad Privada', 'Zonas Verdes']
),
(
  'Penthouse Exclusivo Chicó Norte',
  'penthouse-chico-norte-bogota',
  'Lujoso penthouse ubicado en una de las zonas más exclusivas de Bogotá. Acabados de alta gama, chimenea a gas, estudio independiente y vista panorámica a los cerros.',
  1250000000,
  'Bogotá D.C., Chicó Norte',
  4.6750, -74.0500,
  3, 4, 210,
  'Apartamento', 'En Venta',
  ARRAY['https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&q=80'],
  ARRAY['Vista a los Cerros', 'Chimenea', 'Estudio', 'Ascensor Privado', '2 Parqueaderos']
),
(
  'Casa Campestre Colonial Los Cerezos',
  'casa-campestre-los-cerezos-tunja',
  'Hermosa casa estilo colonial contemporáneo en Tunja. Espacios amplios, iluminación natural, jardín interior, excelente aislamiento térmico y chimenea de leña tradicional.',
  480000000,
  'Tunja, Boyacá',
  5.5353, -73.3678,
  4, 3, 260,
  'Casa', 'En Venta',
  ARRAY['https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1600565193348-f74bd3c7ccdf?auto=format&fit=crop&q=80'],
  ARRAY['Estilo Colonial', 'Jardín Interior', 'Chimenea de Leña', 'Zona BBQ', 'Estudio']
),
(
  'Apartaestudio Inteligente Usaquén',
  'apartaestudio-inteligente-usaquen',
  'Moderno apartaestudio con domótica integrada, cocina abierta con acabados en quarzo, edificio con coworking, terraza comunal y zona de lavandería.',
  245000000,
  'Bogotá D.C., Usaquén',
  4.7000, -74.0300,
  1, 1, 48,
  'Apartamento', 'En Venta',
  ARRAY['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&q=80'],
  ARRAY['Domótica', 'Coworking', 'Terraza BBQ', 'Iluminación LED', 'Gimnasio']
),
(
  'Villa de Descanso Melgar-Apicalá',
  'villa-descanso-melgar',
  'Moderna villa campestre con piscina privada infinity, kiosco de descanso, amplias zonas verdes y cocina tipo isla abierta hacia la zona social.',
  590000000,
  'Carmen de Apicalá, Tolima',
  4.2100, -74.7350,
  4, 4, 280,
  'Villa', 'En Venta',
  ARRAY['https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1512915922686-57c11dde9b6b?auto=format&fit=crop&q=80'],
  ARRAY['Piscina Infinity', 'Kiosco BBQ', 'Ample Garden', 'Aire Acondicionado', 'Totalmente Amoblada']
),
(
  'Casa Familiar Barrio San Antonio',
  'casa-familiar-san-antonio-tunja',
  'Casa residencial de dos niveles en sector tranquilo de Tunja. Cuenta con garaje cubierto para dos vehículos, patio posterior y excelentes vías de acceso.',
  320000000,
  'Tunja, Boyacá',
  5.5450, -73.3580,
  3, 3, 160,
  'Casa', 'En Venta',
  ARRAY['https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&q=80'],
  ARRAY['Garaje Doble', 'Patio Trasero', 'Zona Residencial', 'Closets Empotrados']
),
(
  'Loft Industrial Zona G',
  'loft-industrial-zona-g-bogota',
  'Loft con diseño industrial expuesto, techos de doble altura, ventanales de piso a techo y ubicación privilegiada cerca de los mejores restaurantes de Bogotá.',
  780000000,
  'Bogotá D.C., Zona G',
  4.6550, -74.0530,
  1, 2, 95,
  'Apartamento', 'En Venta',
  ARRAY['https://images.unsplash.com/photo-1536376072261-38c75010e6c9?auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&q=80'],
  ARRAY['Doble Altura', 'Estilo Industrial', 'Zona Gastronómica', 'Seguridad 24/7']
),
(
  'Lote Campestre Condominio El Edén',
  'lote-campestre-carmen-de-apicala',
  'Excelente lote plano de 800 m² dentro de condominio cerrado en Carmen de Apicalá. Ideal para construir la casa de descanso de tus sueños con diseño personalizado.',
  150000000,
  'Carmen de Apicalá, Tolima',
  4.1980, -74.7220,
  0, 0, 800,
  'Lote', 'En Venta',
  ARRAY['https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&q=80'],
  ARRAY['Terreno Plano', 'Servicios Básicos', 'Portería 24 Horas', 'Cancha de Tenis']
),
(
  'Apartamento Moderno Rosales',
  'apartamento-moderno-rosales-bogota',
  'Elegante apartamento con acabados en madera natural, cocina integral italiana, balcón con vista arborizada y excelente iluminación natural.',
  990000000,
  'Bogotá D.C., Rosales',
  4.6520, -74.0550,
  2, 3, 130,
  'Apartamento', 'En Venta',
  ARRAY['https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&q=80'],
  ARRAY['Balcón Panorámico', 'Cocina Italiana', 'Depósito', 'Parqueadero de Visitantes']
),
(
  'Casa Campestre El Prado',
  'casa-campestre-el-prado-tunja',
  'Propiedad campestre en las afueras de Tunja con terreno independiente, árboles frutales, kiosco exterior y chimenea central en sala principal.',
  520000000,
  'Tunja, Boyacá',
  5.5200, -73.3800,
  4, 3, 310,
  'Casa', 'En Venta',
  ARRAY['https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&q=80'],
  ARRAY['Árboles Frutales', 'Amplio Terreno', 'Chimenea Central', 'Tanque de Reserva']
),
(
  'Local Comercial Estratégico Centro',
  'local-comercial-centro-tunja',
  'Local comercial de alta vitrina ubicado sobre vía principal en el centro histórico de Tunja. Ideal para oficinas, franquicias o comercio minorista.',
  410000000,
  'Tunja, Boyacá',
  5.5340, -73.3620,
  0, 2, 110,
  'Comercial', 'En Venta',
  ARRAY['https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&q=80'],
  ARRAY['Alta Vitrina', 'Sobre Vía Principal', 'Baños de Lujo', 'Mezanine']
),
(
  'Duplex Minimalista Chicó',
  'duplex-minimalista-chico-bogota',
  'Espectacular duplex con diseño minimalista, doble altura en área social, terraza privada descubierta y acabados importados de alta gama.',
  1450000000,
  'Bogotá D.C., Chicó',
  4.6780, -74.0520,
  3, 4, 240,
  'Apartamento', 'En Venta',
  ARRAY['https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&q=80'],
  ARRAY['Terraza Privada', 'Doble Altura', 'Seguridad Armada', 'Gimnasio del Edificio']
),
(
  'Casa Quinta Palmeras de Apicalá',
  'casa-quinta-palmeras-carmen',
  'Hermosa casa quinta vacacional con zona de hamacas, piscina rodeada de piedra muñeca, bar húmedo y zonas verdes tropicales.',
  670000000,
  'Carmen de Apicalá, Tolima',
  4.2080, -74.7250,
  5, 5, 320,
  'Casa', 'En Venta',
  ARRAY['https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&q=80'],
  ARRAY['Bar Húmedo', 'Piscina Privada', 'Zona de Hamacas', 'Jardín Tropical']
),
(
  'Apartamento Ejecutivo Salitre',
  'apartamento-ejecutivo-salitre-bogota',
  'Apartamento estratégico cerca al terminal y aeropuerto. Excelente distribución, tres habitaciones, parqueadero cubierto y club house con piscina.',
  390000000,
  'Bogotá D.C., Salitre',
  4.6500, -74.1100,
  3, 2, 85,
  'Apartamento', 'En Venta',
  ARRAY['https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&q=80'],
  ARRAY['Club House', 'Piscina Climatizada', 'Cancha Múltiple', 'Vigilancia 24h']
),
(
  'Cabaña Alpina de Montaña',
  'cabana-alpina-moniquira-tunja',
  'Acogedora cabaña estilo alpino con estructura de madera noble, altillo, chimenea central y vista impresionante hacia las montañas boyacenses.',
  360000000,
  'Tunja, Boyacá',
  5.5100, -73.3900,
  3, 2, 140,
  'Casa', 'En Venta',
  ARRAY['https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1512915922686-57c11dde9b6b?auto=format&fit=crop&q=80'],
  ARRAY['Estilo Alpino', 'Madera Noble', 'Altillo', 'Vista Panorámica']
),
(
  'Casa Moderna Unifamiliar Modelia',
  'casa-moderna-modelia-bogota',
  'Casa unifamiliar remodelada en su totalidad con diseño contemporáneo, circuito cerrado de cámaras, domótica y excelentes espacios sociales.',
  950000000,
  'Bogotá D.C., Modelia',
  4.6650, -74.1200,
  4, 4, 250,
  'Casa', 'En Venta',
  ARRAY['https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1600565193348-f74bd3c7ccdf?auto=format&fit=crop&q=80'],
  ARRAY['Remodelada', 'CCTV', 'Estudio', 'Patio Interior']
),
(
  'Lote Comercial Carmen Central',
  'lote-comercial-carmen-central',
  'Lote con uso de suelo comercial mixto en zona de alta afluencia peatonal en Carmen de Apicalá. Ideal para desarrollo de locales o minimercado.',
  280000000,
  'Carmen de Apicalá, Tolima',
  4.2020, -74.7310,
  0, 0, 450,
  'Lote', 'En Venta',
  ARRAY['https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&q=80'],
  ARRAY['Uso Comercial', 'Zona Céntrica', 'Alta Afluencia', 'Documentos al Día']
),
(
  'Penthouse Con Vista a Tunja',
  'penthouse-panoramico-tunja',
  'Impresionante penthouse en el punto más alto de Tunja, acabados de lujo en marmol, amplio balcón tipo terraza y tres garajes independientes.',
  620000000,
  'Tunja, Boyacá',
  5.5380, -73.3550,
  3, 3, 200,
  'Apartamento', 'En Venta',
  ARRAY['https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&q=80'],
  ARRAY['Acabados en Mármol', '3 Garajes', 'Vista 360 Grados', 'Ascensor Directo']
),
(
  'Casa Campestre El Refugio del Sol',
  'casa-campestre-refugio-sol-apicala',
  'Espectacular casa de descanso con diseño bioclimático, ventilación natural cruzada, piscina privada, zona BBQ profesional y jardines ornamentales.',
  720000000,
  'Carmen de Apicalá, Tolima',
  4.2150, -74.7380,
  4, 4, 300,
  'Casa', 'En Venta',
  ARRAY['https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&q=80'],
  ARRAY['Diseño Bioclimático', 'Piscina Privada', 'BBQ Profesional', 'Jardines Ornamentales']
),
(
  'Apartamento Acogedor Zona Norte',
  'apartamento-acogedor-norte-bogota',
  'Acogedor apartamento de dos habitaciones en conjunto cerrado con zonas infantiles, salón comunal y vigilancia privada 24/7.',
  310000000,
  'Bogotá D.C., Norte',
  4.7200, -74.0400,
  2, 2, 68,
  'Apartamento', 'En Venta',
  ARRAY['https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&q=80'],
  ARRAY['Conjunto Cerrado', 'Parques Infantiles', 'Salón Comunal', 'Parqueadero Propio']
)
ON CONFLICT (slug) DO NOTHING
RETURNING slug
)
UPDATE public.properties p
SET municipality = coalesce(nullif(trim(split_part(p.location, ',', 1)), ''), ''),
    "ubicación" = coalesce(nullif(trim(split_part(p.location, ',', 2)), ''), ''),
    categories = case
      when p.type = 'Comercial' then array['Buy', 'Commercial']::text[]
      when p.slug = 'condominio-bambu-carmen-de-apicala' then array['Buy', 'Projects']::text[]
      when p.status ilike '%arriendo%' then array['Rent']::text[]
      else array['Buy']::text[]
    end,
    payment = case
      when p.slug = 'condominio-bambu-carmen-de-apicala' then array['30% de cuota inicial', 'Pagos mensuales según certificación de avance de obra', 'Esquema transparente y seguro']::text[]
      else '{}'::text[]
    end,
    featured = p.slug = 'condominio-bambu-carmen-de-apicala',
    is_published = true,
    updated_at = now()
FROM public.property_types pt
WHERE p.slug IN (select slug from imported)
  AND lower(p.type) = lower(pt.label);
