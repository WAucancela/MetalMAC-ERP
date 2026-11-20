-- Pedidos de la Tienda de Muebles hechos desde tallermac-web (sitio nuevo). Reemplaza
-- el flujo de `pedidos_woocommerce` para la tienda: mismo patrón de bandeja cruda que
-- el equipo revisa a mano (ver comentario en esa tabla), pero sin depender de
-- WooCommerce. No hay cobro en línea todavía (sin pasarela de pago configurada) — el
-- pedido queda `PENDIENTE_CONTACTO` y el equipo coordina el pago y la entrega.
create type estado_pedido_tienda as enum ('PENDIENTE_CONTACTO', 'CONTACTADO', 'PAGADO', 'ENTREGADO', 'CANCELADO');

create table pedidos_tienda (
  id                uuid primary key default gen_random_uuid(),
  cliente_nombre    text not null,
  cliente_email     text not null,
  cliente_telefono  text not null default '',
  total             numeric(14,4) not null default 0,
  estado            estado_pedido_tienda not null default 'PENDIENTE_CONTACTO',
  notas             text not null default '',
  creado_en         timestamptz not null default now()
);
create index pedidos_tienda_estado_creado_idx on pedidos_tienda(estado, creado_en desc);

create table pedido_tienda_lineas (
  id            uuid primary key default gen_random_uuid(),
  pedido_id     uuid not null references pedidos_tienda(id) on delete cascade,
  producto_id   uuid references productos(id),
  descripcion   text not null,
  cantidad      numeric(14,6) not null default 1,
  precio_unitario numeric(14,4) not null,
  subtotal      numeric(14,4) not null
);
create index pedido_tienda_lineas_pedido_id_idx on pedido_tienda_lineas(pedido_id);

alter table pedidos_tienda        enable row level security;
alter table pedido_tienda_lineas  enable row level security;

-- El sitio público inserta con la clave anónima (igual que solicitudes_contacto);
-- solo el equipo autenticado puede leer/actualizar.
create policy pedidos_tienda_insert_anon on pedidos_tienda
  for insert to anon with check (true);
create policy pedido_tienda_lineas_insert_anon on pedido_tienda_lineas
  for insert to anon with check (true);

create policy pedidos_tienda_select_staff on pedidos_tienda
  for select using (auth.role() = 'authenticated');
create policy pedidos_tienda_update_staff on pedidos_tienda
  for update using (auth.role() = 'authenticated');
create policy pedido_tienda_lineas_select_staff on pedido_tienda_lineas
  for select using (auth.role() = 'authenticated');

grant insert on pedidos_tienda, pedido_tienda_lineas to anon;
grant select, update on pedidos_tienda to authenticated;
grant select on pedido_tienda_lineas to authenticated;
grant select, insert, update, delete on pedidos_tienda, pedido_tienda_lineas to service_role;
