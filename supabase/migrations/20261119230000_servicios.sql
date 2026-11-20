-- Catálogo real de servicios de MetalMAC — hasta ahora esta información solo
-- existía como copy de marketing en tallermac-web (lib/content.ts), sin tabla
-- ni tool que el agente de WhatsApp pudiera consultar. Mismo problema que
-- resolvió `productos` + `buscar_productos` para el bot: sin esto, una
-- pregunta por un servicio no tiene de dónde sacar información real y el
-- agente podría terminar inventando alcance o detalles.
--
-- `detalle` es jsonb (array de strings) en vez de una tabla aparte — son
-- bullets de marketing fijos por servicio, no datos que se consulten o
-- filtren por separado.
create table servicios (
  id          uuid primary key default gen_random_uuid(),
  codigo      text not null unique,
  nombre      text not null,
  descripcion text not null,
  detalle     jsonb not null default '[]'::jsonb,
  activo      boolean not null default true,
  creado_en   timestamptz not null default now()
);
create index servicios_activo_nombre_idx on servicios(activo, nombre);

alter table servicios enable row level security;
create policy servicios_select on servicios for select using (auth.role() = 'authenticated');

-- Seed con los 6 servicios reales publicados en tallermac-web (lib/content.ts
-- SERVICES) — única fuente de verdad hasta hoy, ahora duplicada acá para que
-- el ERP (y el agente de WhatsApp) tengan de dónde leerla sin pegarle al sitio.
insert into servicios (codigo, nombre, descripcion, detalle) values
  ('STR', 'Estructura Metálica e Ingeniería',
   'Naves industriales, mezzanines y escaleras de emergencia bajo norma de seguridad industrial.',
   '["Naves Industriales: construcción de galpones, bodegas y cubiertas de grandes luces.","Mezzanines y Entrepisos: optimización de espacios para almacenamiento y oficinas.","Escaleras de Emergencia: diseños bajo norma de seguridad industrial y bomberos."]'::jsonb),
  ('SST', 'Fabricación en Acero Inoxidable',
   'Cocinas industriales, línea médica y diseño arquitectónico en AISI 304 y 316.',
   '["Cocinas Industriales: mesones de trabajo, fregaderos industriales y campanas extractoras.","Línea Médica: mesas quirúrgicas, vitrinas para instrumental y mobiliario clínico.","Diseño Arquitectónico: pasamanos, barandas y detalles decorativos modernos."]'::jsonb),
  ('CUT', 'Procesamiento Industrial',
   'Corte láser, doblado CNC y pintura electrostática de alta resistencia.',
   '["Corte Láser de Alta Precisión: planchas de acero inoxidable, acero al carbono y aluminio.","Doblado CNC: doblez de precisión en diversos ángulos y calibres.","Pintura Electrostática (Powder Coating): acabado de máxima durabilidad en varios colores y texturas."]'::jsonb),
  ('SEC', 'Seguridad y Automatización Perimetral',
   'Portones automatizados, cercos eléctricos y gabinetes antivandalismo.',
   '["Portones de Seguridad: fabricación a medida con integración de sistemas de automatización.","Cercos Eléctricos: instalación certificada y mantenimiento integral.","Gabinetes Antivandalismo: cajas reforzadas para protección de equipos en exteriores."]'::jsonb),
  ('CCTV', 'Infraestructura Tecnológica y CCTV',
   'Postes, brazos articulados y gabinetes para equipos de telecomunicaciones.',
   '["Postes para CCTV: fabricación según requerimientos de altura y carga.","Brazos Articulados: soportes para cámaras de seguridad e iluminación LED.","Gabinetes para Telecomunicaciones: cajas metálicas para equipos eléctricos y de datos."]'::jsonb),
  ('SIGN', 'Identidad Corporativa y Señalética',
   'Tótems, letras corpóreas 3D y señalética industrial de alta durabilidad.',
   '["Tótems Corporativos: estructuras publicitarias de alto impacto con acabados premium.","Letras Corpóreas (3D): logotipos y letras en relieve para fachadas y oficinas.","Señalética Industrial: placas informativas de alta durabilidad."]'::jsonb);
