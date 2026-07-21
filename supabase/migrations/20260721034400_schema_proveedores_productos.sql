-- Proveedores, Equivalencias
create table proveedores (
  id                     uuid primary key default gen_random_uuid(),
  ruc                    text not null unique check (ruc ~ '^\d{13}$'),
  razon_social           text not null,
  nombre_comercial       text not null default '',
  tipo_contribuyente     tipo_contribuyente not null,
  contribuyente_especial boolean not null default false,
  obliga_contabilidad    boolean not null default false,
  agente_retencion       boolean not null default false,
  dias_credito           integer not null default 0,
  telefono_principal     text not null default '',
  email_principal        text not null default '',
  ciudad                 text not null default '',
  activo                 boolean not null default true
);
create index proveedores_activo_razon_social_idx on proveedores(activo, razon_social);

create table proveedores_contactos (
  id           uuid primary key default gen_random_uuid(),
  proveedor_id uuid not null references proveedores(id) on delete cascade,
  nombre       text not null,
  cargo        text not null default '',
  telefono     text not null default '',
  email        text not null default '',
  es_principal boolean not null default false
);
create index proveedores_contactos_proveedor_id_idx on proveedores_contactos(proveedor_id);

create table tabla_equivalencias (
  id                    uuid primary key default gen_random_uuid(),
  proveedor_id          uuid not null references proveedores(id),
  codigo_proveedor      text not null,
  descripcion_proveedor text not null default '',
  material_id           uuid not null references materiales(id),
  unidad_proveedor_id   uuid not null references unidades_medida(id),
  factor_conversion     numeric(14,6) not null check (factor_conversion > 0),
  precio_referencia     numeric(14,4) not null default 0,
  activo                boolean not null default true
);
create unique index tabla_equivalencias_proveedor_codigo_uq on tabla_equivalencias(proveedor_id, codigo_proveedor);
create index tabla_equivalencias_proveedor_activo_idx      on tabla_equivalencias(proveedor_id, activo);

-- Productos, BOM
create table productos (
  id           uuid primary key default gen_random_uuid(),
  codigo       text not null unique,
  nombre       text not null,
  descripcion  text not null default '',
  tipo         tipo_producto not null,
  unidad_venta text not null default '',
  precio_venta numeric(14,4) not null default 0,
  activo       boolean not null default true
);
create index productos_tipo_activo_nombre_idx on productos(tipo, activo, nombre);
create index productos_activo_nombre_idx      on productos(activo, nombre);

create table boms (
  producto_id       uuid primary key references productos(id) on delete cascade,
  version           integer not null default 1,
  costo_materiales  numeric(14,4) not null default 0,
  costo_operaciones numeric(14,4) not null default 0,
  costo_total       numeric(14,4) not null default 0,
  actualizado_en    timestamptz not null default now()
);

create table bom_lineas (
  id                 uuid primary key default gen_random_uuid(),
  bom_producto_id    uuid not null references boms(producto_id) on delete cascade,
  orden              integer not null,
  material_id        uuid not null references materiales(id),
  cantidad_base      numeric(14,6) not null,
  factor_merma       numeric(8,4) not null default 1,
  cantidad_con_merma numeric(14,6) not null,
  unidad_id          uuid not null references unidades_medida(id),
  notas              text not null default ''
);
create index bom_lineas_bom_producto_id_idx on bom_lineas(bom_producto_id, orden);

create table bom_operaciones (
  id               uuid primary key default gen_random_uuid(),
  bom_producto_id  uuid not null references boms(producto_id) on delete cascade,
  orden            integer not null,
  tipo             tipo_operacion not null,
  minutos          numeric(10,2) not null,
  costo_por_minuto numeric(10,4) not null,
  costo_total      numeric(14,4) not null
);
create index bom_operaciones_bom_producto_id_idx on bom_operaciones(bom_producto_id, orden);
