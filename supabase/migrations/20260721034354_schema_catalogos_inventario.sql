-- Extensiones y enums
create extension if not exists pgcrypto;

create type tipo_unidad_medida      as enum ('PESO','LONGITUD','AREA','VOLUMEN','UNIDAD');
create type tipo_material           as enum ('PLANCHA','TUBO','PERFIL','VARILLA','CONSUMIBLE');
create type tipo_contribuyente      as enum ('PERSONA_NATURAL','SOCIEDAD','RISE');
create type tipo_movimiento         as enum ('ENTRADA','SALIDA','AJUSTE_POSITIVO','AJUSTE_NEGATIVO','RESERVA','LIBERACION','MERMA','DEVOLUCION');
create type tipo_documento          as enum ('FACTURA_COMPRA','ORDEN_PRODUCCION','AJUSTE_MANUAL');
create type estado_factura_compra   as enum ('PENDIENTE','PROCESADA','ANULADA');
create type estado_factura_venta    as enum ('BORRADOR','EMITIDA','ANULADA');
create type tipo_retencion          as enum ('RENTA','IVA');
create type tipo_producto           as enum ('PRODUCTO_TERMINADO','SEMIELABORADO');
create type estado_orden_produccion as enum ('BORRADOR','EN_PROCESO','COMPLETADA','CANCELADA');
create type tipo_operacion          as enum ('LASER','SOLDADURA','DOBLADO','ENSAMBLE');
create type estado_proyecto         as enum ('PLANIFICACION','ACTIVO','PAUSADO','COMPLETADO','CANCELADO');
create type categoria_gasto         as enum ('MATERIALES','MANO_DE_OBRA','MAQUINARIA','TRANSPORTE','SUBCONTRATO','ADMINISTRATIVO','OTRO');
create type rol_usuario             as enum ('GERENTE','BODEGUERO','PRODUCCION','CONTABILIDAD');

-- Catálogos
create table unidades_medida (
  id      uuid primary key default gen_random_uuid(),
  nombre  text not null,
  simbolo text not null,
  tipo    tipo_unidad_medida not null
);

create table categorias (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  parent_id   uuid references categorias(id) on delete set null,
  descripcion text not null default ''
);
create index categorias_parent_id_idx on categorias(parent_id);

-- Materiales, Stock, Movimientos
create table materiales (
  id               uuid primary key default gen_random_uuid(),
  codigo_interno   text not null unique,
  nombre           text not null,
  descripcion      text not null default '',
  tipo             tipo_material not null,
  categoria_id     uuid not null references categorias(id),
  grado            text not null default '',
  unidad_base_id   uuid not null references unidades_medida(id),
  costo_unitario   numeric(14,4) not null default 0,
  especificaciones jsonb not null default '{}'::jsonb,
  activo           boolean not null default true,
  creado_en        timestamptz not null default now(),
  modificado_en    timestamptz not null default now()
);
create index materiales_tipo_nombre_idx   on materiales(tipo, nombre);
create index materiales_activo_nombre_idx on materiales(activo, nombre);
create index materiales_categoria_id_idx  on materiales(categoria_id);

create table stock (
  material_id         uuid primary key references materiales(id) on delete cascade,
  cantidad_disponible numeric(14,6) not null default 0,
  cantidad_reservada  numeric(14,6) not null default 0,
  cantidad_minima     numeric(14,6) not null default 0,
  cantidad_maxima     numeric(14,6),
  ubicacion           text not null default '',
  actualizado_en      timestamptz not null default now(),
  constraint stock_no_negativo check (cantidad_disponible >= 0 and cantidad_reservada >= 0)
);

create table movimientos_inventario (
  id                uuid primary key default gen_random_uuid(),
  material_id       uuid not null references materiales(id),
  tipo              tipo_movimiento not null,
  cantidad          numeric(14,6) not null check (cantidad > 0),
  stock_anterior    numeric(14,6) not null,
  stock_posterior   numeric(14,6) not null,
  costo_unitario    numeric(14,4) not null default 0,
  documento_tipo    tipo_documento not null,
  documento_id      uuid,
  numero_referencia text not null default '',
  notas             text not null default '',
  usuario_id        uuid not null references auth.users(id),
  fecha             timestamptz not null default now()
);
create index movimientos_material_fecha_idx on movimientos_inventario(material_id, fecha desc);
create index movimientos_tipo_fecha_idx     on movimientos_inventario(tipo, fecha desc);
create index movimientos_fecha_id_idx       on movimientos_inventario(fecha desc, id desc); -- cursor keyset

-- Ledger append-only: incluso service_role no puede UPDATE/DELETE una fila ya escrita.
create function forbid_update_delete() returns trigger language plpgsql as $$
begin
  raise exception 'movimientos_inventario es append-only: % no permitido', tg_op;
end $$;
create trigger movimientos_no_update before update on movimientos_inventario
  for each row execute function forbid_update_delete();
create trigger movimientos_no_delete before delete on movimientos_inventario
  for each row execute function forbid_update_delete();
