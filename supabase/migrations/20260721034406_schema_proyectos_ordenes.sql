-- Proyectos (antes que Órdenes, que le hacen FK)
create table proyectos (
  id              uuid primary key default gen_random_uuid(),
  codigo          text not null unique,
  nombre          text not null,
  descripcion     text not null default '',
  cliente         text not null,
  presupuesto     numeric(14,4) not null,
  costo_estimado  numeric(14,4) not null default 0,
  costo_real      numeric(14,4) not null default 0,  -- mantenido por trigger, nunca escrito manualmente
  estado          estado_proyecto not null default 'PLANIFICACION',
  fecha_inicio    date not null,
  fecha_fin       date,
  responsable_id  uuid not null references auth.users(id),
  creado_en       timestamptz not null default now(),
  creado_por      uuid not null references auth.users(id),
  actualizado_en  timestamptz not null default now(),
  actualizado_por uuid references auth.users(id)
);
create index proyectos_estado_fecha_inicio_idx on proyectos(estado, fecha_inicio desc);
create index proyectos_estado_creado_idx       on proyectos(estado, creado_en desc);
-- Nota: `proyectos.ordenesProduccion: string[]` de Firestore NO se porta — es un índice inverso
-- redundante de `ordenes_produccion.proyecto_id` (FK), que ya cubre esa consulta con un SELECT ... WHERE.

-- Facturas de Compra
create table facturas_compra (
  id               uuid primary key default gen_random_uuid(),
  proveedor_id     uuid not null references proveedores(id),
  clave_acceso     text not null unique check (clave_acceso ~ '^\d{49}$'),
  numero_factura   text not null,
  fecha_emision    date not null,
  subtotal_sin_iva numeric(14,4) not null,
  iva              numeric(14,4) not null,
  total            numeric(14,4) not null,
  xml_url          text not null default '',  -- ruta relativa al bucket, no URL pública
  estado           estado_factura_compra not null default 'PENDIENTE',
  creado_en        timestamptz not null default now()
);
create index facturas_compra_proveedor_fecha_idx        on facturas_compra(proveedor_id, fecha_emision desc);
create index facturas_compra_estado_fecha_idx           on facturas_compra(estado, fecha_emision desc);
create index facturas_compra_proveedor_estado_fecha_idx on facturas_compra(proveedor_id, estado, fecha_emision desc);

create table factura_compra_lineas (
  id                  uuid primary key default gen_random_uuid(),
  factura_id          uuid not null references facturas_compra(id) on delete cascade,
  orden               integer not null,
  codigo_proveedor    text not null,
  descripcion         text not null,
  cantidad            numeric(14,6) not null,
  precio_unitario     numeric(14,4) not null,
  descuento           numeric(14,4) not null default 0,
  subtotal            numeric(14,4) not null,
  material_id         uuid references materiales(id),
  cantidad_convertida numeric(14,6)
);
create index factura_compra_lineas_factura_id_idx on factura_compra_lineas(factura_id, orden);

create table factura_compra_retenciones (
  id         uuid primary key default gen_random_uuid(),
  factura_id uuid not null references facturas_compra(id) on delete cascade,
  tipo       tipo_retencion not null,
  porcentaje numeric(6,4) not null,
  base       numeric(14,4) not null,
  valor      numeric(14,4) not null
);
create index factura_compra_retenciones_factura_id_idx on factura_compra_retenciones(factura_id);

-- Órdenes de Producción
create table ordenes_produccion (
  id               uuid primary key default gen_random_uuid(),
  codigo           text not null unique,
  producto_id      uuid not null references productos(id),
  cantidad         numeric(14,4) not null check (cantidad > 0),
  estado           estado_orden_produccion not null default 'BORRADOR',
  fecha_inicio     timestamptz not null default now(),
  fecha_entrega    date not null,
  costo_estimado   numeric(14,4) not null default 0,
  costo_real       numeric(14,4),
  fecha_completada timestamptz,
  proyecto_id      uuid references proyectos(id),
  notas            text not null default '',
  creado_en        timestamptz not null default now(),
  creado_por       uuid not null references auth.users(id),
  actualizado_en   timestamptz not null default now(),
  actualizado_por  uuid references auth.users(id)
);
create index ordenes_estado_fecha_entrega_idx          on ordenes_produccion(estado, fecha_entrega);
create index ordenes_producto_estado_fecha_entrega_idx on ordenes_produccion(producto_id, estado, fecha_entrega);
create index ordenes_proyecto_estado_fecha_entrega_idx on ordenes_produccion(proyecto_id, estado, fecha_entrega);
create index ordenes_creado_en_idx                     on ordenes_produccion(creado_en);

create table orden_materiales_reservados (
  id                        uuid primary key default gen_random_uuid(),
  orden_id                  uuid not null references ordenes_produccion(id) on delete cascade,
  material_id               uuid not null references materiales(id),
  cantidad_reservada        numeric(14,6) not null,
  costo_unitario_al_momento numeric(14,4) not null
);
create unique index orden_materiales_reservados_orden_material_uq on orden_materiales_reservados(orden_id, material_id);

-- Gastos de Proyecto
create table gastos_proyecto (
  id           uuid primary key default gen_random_uuid(),
  proyecto_id  uuid not null references proyectos(id) on delete cascade,
  categoria    categoria_gasto not null,
  descripcion  text not null,
  monto        numeric(14,4) not null check (monto > 0),
  fecha        date not null,
  proveedor_id uuid references proveedores(id),
  factura_id   uuid references facturas_compra(id),
  orden_id     uuid references ordenes_produccion(id),
  comprobante  text,  -- ruta en storage
  creado_en    timestamptz not null default now(),
  creado_por   uuid not null references auth.users(id)
);
create index gastos_proyecto_id_fecha_idx       on gastos_proyecto(proyecto_id, fecha desc);
create index gastos_proyecto_categoria_fecha_idx on gastos_proyecto(proyecto_id, categoria, fecha desc);

-- facturas_venta: el tipo existe en metalmac.types.ts pero no hay rutas API confirmadas que lo usen.
-- Se incluye el esquema por completitud; su API se construye en una fase posterior si se confirma que se necesita.
create table facturas_venta (
  id               uuid primary key default gen_random_uuid(),
  cliente_nombre   text not null,
  cliente_ruc      text not null,
  clave_acceso     text not null unique,
  numero_factura   text not null,
  fecha_emision    date not null,
  subtotal_sin_iva numeric(14,4) not null,
  iva              numeric(14,4) not null,
  total            numeric(14,4) not null,
  estado           estado_factura_venta not null default 'BORRADOR',
  creado_en        timestamptz not null default now()
);
create table factura_venta_lineas (
  id                  uuid primary key default gen_random_uuid(),
  factura_id          uuid not null references facturas_venta(id) on delete cascade,
  orden               integer not null,
  descripcion         text not null,
  cantidad            numeric(14,6) not null,
  precio_unitario     numeric(14,4) not null,
  subtotal            numeric(14,4) not null,
  orden_produccion_id uuid references ordenes_produccion(id)
);

-- Perfiles (espejo humano-legible del rol; el JWT app_metadata.rol sigue siendo la fuente rápida)
create table perfiles (
  id        uuid primary key references auth.users(id) on delete cascade,
  email     text not null,
  rol       rol_usuario not null,
  creado_en timestamptz not null default now()
);
