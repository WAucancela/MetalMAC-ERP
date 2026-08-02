-- Planificación de planta: catálogo de operarios + snapshot de operaciones por OP.
--
-- Mismo criterio que orden_materiales_reservados: al iniciar la OP (BORRADOR →
-- EN_PROCESO) se copian las operaciones del BOM vigente en ese momento a
-- orden_operaciones — si el BOM cambia después, la OP ya en curso no se ve
-- afectada. Sin RPC de lock: a diferencia de materiales/secuenciales, acá no se
-- compite por un recurso compartido (cada OP inserta sus propias filas una sola
-- vez), así que un insert directo desde la ruta API alcanza.

create type estado_operacion_produccion as enum ('PENDIENTE', 'COMPLETADA');

create table operarios (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  activo     boolean not null default true,
  creado_en  timestamptz not null default now()
);
create index operarios_activo_nombre_idx on operarios(activo, nombre);

create table orden_operaciones (
  id                    uuid primary key default gen_random_uuid(),
  orden_id              uuid not null references ordenes_produccion(id) on delete cascade,
  orden                 integer not null,              -- secuencia de ejecución (de bom_operaciones.orden)
  tipo                  tipo_operacion not null,
  minutos_planificados  numeric(10,2) not null,
  costo_por_minuto      numeric(10,4) not null,
  operario_id           uuid references operarios(id),
  estado                estado_operacion_produccion not null default 'PENDIENTE',
  minutos_reales        numeric(10,2),
  completada_en         timestamptz,
  completada_por        uuid references auth.users(id)
);
create index orden_operaciones_orden_id_idx on orden_operaciones(orden_id, orden);

-- RLS: mismo patrón que el resto del schema — sólo policy de SELECT para
-- `authenticated`; toda escritura pasa por las API routes con service_role.
alter table operarios         enable row level security;
alter table orden_operaciones enable row level security;

create policy operarios_select         on operarios         for select using (auth.role() = 'authenticated');
create policy orden_operaciones_select on orden_operaciones  for select using (auth.role() = 'authenticated');

-- Grants: service_role ya las hereda vía el `alter default privileges` de
-- 20260721041038_grants_and_permissions.sql, pero se deja explícito igual que
-- se hizo para facturas_venta.
grant select, insert, update, delete on operarios, orden_operaciones to service_role;
grant select on operarios, orden_operaciones to authenticated;
