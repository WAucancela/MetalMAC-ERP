-- Solicitudes crudas de cotización/contacto desde el sitio público (tallermac.com,
-- formulario "Cotizar mi Proyecto"). Vive separada de `cotizaciones` a propósito:
-- esto es un lead sin calificar que llega de cualquier visitante anónimo, nunca un
-- precio formal. El equipo revisa esta bandeja y, si procede, recién ahí crea una
-- `cotizacion` real a mano (mismo patrón que `pedidos_woocommerce`: bandeja cruda
-- separada del sistema real, nunca se auto-convierte).
create type estado_solicitud_contacto as enum ('NUEVA', 'CONTACTADA', 'DESCARTADA');

create table solicitudes_contacto (
  id                uuid primary key default gen_random_uuid(),
  nombre            text not null,
  email             text not null default '',
  telefono          text not null default '',
  servicio_interes  text not null default '',
  descripcion       text not null default '',
  estado            estado_solicitud_contacto not null default 'NUEVA',
  origen            text not null default 'sitio_web',
  creado_en         timestamptz not null default now()
);
create index solicitudes_contacto_estado_creado_idx on solicitudes_contacto(estado, creado_en desc);

alter table solicitudes_contacto enable row level security;

-- El sitio público inserta con la clave anónima; nunca puede leer, actualizar ni
-- borrar (eso es solo para el equipo autenticado en el ERP).
create policy solicitudes_contacto_insert_anon on solicitudes_contacto
  for insert to anon with check (true);

create policy solicitudes_contacto_select_staff on solicitudes_contacto
  for select using (auth.role() = 'authenticated');

create policy solicitudes_contacto_update_staff on solicitudes_contacto
  for update using (auth.role() = 'authenticated');

grant insert on solicitudes_contacto to anon;
grant select, update on solicitudes_contacto to authenticated;
grant select, insert, update, delete on solicitudes_contacto to service_role;
