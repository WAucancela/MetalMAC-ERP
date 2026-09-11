-- Módulo de Clientes (CRM liviano) — fuente única de verdad para los datos de
-- cliente, hoy duplicados como texto libre en cotizaciones, proyectos,
-- facturas_venta y pedidos_woocommerce (cada uno con su propia copia
-- desincronizada de nombre/email, sin ninguna relación entre sí).
--
-- `identificacion` es NULLABLE a propósito: muchas cotizaciones rápidas o
-- clientes ocasionales no tienen RUC/cédula registrado todavía — no se
-- inventa un valor. El índice único parcial de abajo solo exige unicidad
-- cuando el dato sí existe.
create table clientes (
  id                  uuid primary key default gen_random_uuid(),
  -- Texto libre (no enum) a propósito: es una lista abierta que puede sumar
  -- 'PASAPORTE' u otros tipos de identificación extranjera sin migración de tipo.
  tipo_identificacion text,
  identificacion      text,
  razon_social        text not null,
  nombre_comercial    text not null default '',
  email               text not null default '',
  telefono            text not null default '',
  whatsapp            text not null default '',
  direccion           text not null default '',
  ciudad              text not null default '',
  notas               text not null default '',
  activo              boolean not null default true,
  creado_en           timestamptz not null default now(),
  creado_por          uuid references auth.users(id)
);
create unique index clientes_identificacion_unq
  on clientes(identificacion) where identificacion is not null and identificacion <> '';
create index clientes_activo_razon_social_idx on clientes(activo, razon_social);
create index clientes_email_idx on clientes(email) where email <> '';

-- Timeline de interacciones — la trazabilidad que pidió el negocio: quién
-- habló con el cliente, cuándo, y qué se dijo, sin depender de la memoria
-- de quien lo atendió.
create table clientes_interacciones (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid not null references clientes(id) on delete cascade,
  tipo        text not null,   -- LLAMADA | EMAIL | REUNION | NOTA
  descripcion text not null,
  creado_por  uuid not null references auth.users(id),
  creado_en   timestamptz not null default now()
);
create index clientes_interacciones_cliente_idx on clientes_interacciones(cliente_id, creado_en desc);

-- Enlace hacia el cliente unificado en las 4 tablas que hoy duplican el dato
-- como texto — nullable y sin borrar las columnas de texto existentes, que
-- quedan como snapshot histórico de cómo se llamaba el cliente en ese
-- momento (mismo patrón que ya usa `cotizacion_lineas.producto_id`).
alter table cotizaciones         add column cliente_id uuid references clientes(id);
alter table proyectos            add column cliente_id uuid references clientes(id);
alter table facturas_venta       add column cliente_id uuid references clientes(id);
alter table pedidos_woocommerce  add column cliente_id uuid references clientes(id);

create index cotizaciones_cliente_id_idx        on cotizaciones(cliente_id);
create index proyectos_cliente_id_idx           on proyectos(cliente_id);
create index facturas_venta_cliente_id_idx      on facturas_venta(cliente_id);
create index pedidos_woocommerce_cliente_id_idx on pedidos_woocommerce(cliente_id);

alter table clientes               enable row level security;
alter table clientes_interacciones enable row level security;

create policy clientes_select               on clientes               for select using (auth.role() = 'authenticated');
create policy clientes_interacciones_select on clientes_interacciones for select using (auth.role() = 'authenticated');

grant select on clientes, clientes_interacciones to authenticated;
grant select, insert, update, delete on clientes, clientes_interacciones to service_role;
