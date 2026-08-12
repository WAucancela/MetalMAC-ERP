-- Catálogo editable de tipos de operación — reemplaza el enum fijo tipo_operacion
-- (LASER/SOLDADURA/DOBLADO/ENSAMBLE) por una tabla, mismo patrón que `operarios`,
-- para que el usuario pueda agregar sus propios tipos (Corte plasma, Pintura,
-- Perforado, etc.) sin depender de una migración por cada uno nuevo.

create table tipos_operacion (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  activo     boolean not null default true,
  creado_en  timestamptz not null default now()
);
create index tipos_operacion_activo_nombre_idx on tipos_operacion(activo, nombre);

-- Semilla con los 4 valores que ya existían como enum, para no perder los datos
-- ya guardados en bom_operaciones/orden_operaciones.
insert into tipos_operacion (nombre) values ('LASER'), ('SOLDADURA'), ('DOBLADO'), ('ENSAMBLE');

alter table bom_operaciones add column tipo_operacion_id uuid references tipos_operacion(id);
update bom_operaciones bo set tipo_operacion_id = t.id from tipos_operacion t where t.nombre = bo.tipo::text;
alter table bom_operaciones alter column tipo_operacion_id set not null;
alter table bom_operaciones drop column tipo;

alter table orden_operaciones add column tipo_operacion_id uuid references tipos_operacion(id);
update orden_operaciones oo set tipo_operacion_id = t.id from tipos_operacion t where t.nombre = oo.tipo::text;
alter table orden_operaciones alter column tipo_operacion_id set not null;
alter table orden_operaciones drop column tipo;

drop type tipo_operacion;

alter table tipos_operacion enable row level security;
create policy tipos_operacion_select on tipos_operacion for select using (auth.role() = 'authenticated');
grant select, insert, update, delete on tipos_operacion to service_role;
grant select on tipos_operacion to authenticated;
