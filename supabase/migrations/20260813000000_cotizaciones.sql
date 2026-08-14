-- Cotizaciones: propuesta de precio para un cliente, con líneas que referencian el
-- catálogo real (productos y/o materiales — nunca se retipea precio/descripción a
-- mano si ya existe en el sistema). Vive antes del proyecto/factura en el flujo de
-- venta: cotización → (aprobada por el cliente) → recién ahí se arma el proyecto o
-- la factura, a mano por ahora (convertir automático queda para un siguiente paso).
--
-- numero usa el mismo contador genérico `siguiente_secuencia_anual` que ya usan
-- OP-YYYY-NNNN / PRY-YYYY-NNNN (ver counters_and_triggers.sql) — prefijo 'COT'.

create type estado_cotizacion as enum ('BORRADOR', 'ENVIADA', 'APROBADA', 'RECHAZADA', 'VENCIDA');

create table cotizaciones (
  id                  uuid primary key default gen_random_uuid(),
  numero              text not null unique,
  cliente_nombre      text not null,
  cliente_email       text not null default '',
  cliente_whatsapp    text not null default '',
  proyecto_id         uuid references proyectos(id),
  estado              estado_cotizacion not null default 'BORRADOR',
  fecha_emision       date not null,
  fecha_vencimiento   date not null,
  subtotal_sin_iva    numeric(14,4) not null default 0,
  iva                 numeric(14,4) not null default 0,
  total               numeric(14,4) not null default 0,
  notas               text not null default '',
  email_enviado_en     timestamptz,
  ultimo_seguimiento_en timestamptz,
  veces_recordado     integer not null default 0,
  creado_en           timestamptz not null default now(),
  creado_por          uuid not null references auth.users(id)
);
create index cotizaciones_estado_fecha_idx        on cotizaciones(estado, fecha_emision desc);
create index cotizaciones_proyecto_id_idx         on cotizaciones(proyecto_id);
-- Usado por el cron de seguimiento: "cotizaciones ENVIADA que ya vencieron" y
-- "ENVIADA sin recordatorio reciente" filtran por (estado, fecha_vencimiento) y
-- (estado, ultimo_seguimiento_en) respectivamente.
create index cotizaciones_seguimiento_idx on cotizaciones(estado, fecha_vencimiento) where estado = 'ENVIADA';

create table cotizacion_lineas (
  id              uuid primary key default gen_random_uuid(),
  cotizacion_id   uuid not null references cotizaciones(id) on delete cascade,
  orden           integer not null,
  descripcion     text not null,
  cantidad        numeric(14,6) not null,
  precio_unitario numeric(14,4) not null,
  subtotal        numeric(14,4) not null,
  producto_id     uuid references productos(id),
  material_id     uuid references materiales(id)
);
create index cotizacion_lineas_cotizacion_id_idx on cotizacion_lineas(cotizacion_id, orden);

alter table cotizaciones      enable row level security;
alter table cotizacion_lineas enable row level security;

create policy cotizaciones_select      on cotizaciones      for select using (auth.role() = 'authenticated');
create policy cotizacion_lineas_select on cotizacion_lineas for select using (auth.role() = 'authenticated');

grant select on cotizaciones, cotizacion_lineas to authenticated;
grant select, insert, update, delete on cotizaciones, cotizacion_lineas to service_role;
