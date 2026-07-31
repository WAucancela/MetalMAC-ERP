-- Bandeja de revisión de pedidos de tallermac.com (WooCommerce).
--
-- Un pedido de WooCommerce entra vía webhook (app/api/webhooks/woocommerce) y queda
-- pendiente de revisión; el staff (GERENTE/PRODUCCION) decide manualmente qué línea se
-- convierte en qué orden_produccion — nunca se crea una OP automáticamente.

create type estado_revision_pedido as enum ('PENDIENTE', 'EN_REVISION', 'CONVERTIDO', 'RECHAZADO');

create table pedidos_woocommerce (
  id              uuid primary key default gen_random_uuid(),
  wc_order_id     bigint not null unique,
  wc_status       text not null,
  numero_pedido   text not null,
  cliente_nombre  text not null default '',
  cliente_email   text not null default '',
  total           numeric(14,4) not null default 0,
  moneda          text not null default 'USD',
  estado_revision estado_revision_pedido not null default 'PENDIENTE',
  notas           text not null default '',
  payload         jsonb not null,
  recibido_en     timestamptz not null default now(),
  procesado_en    timestamptz,
  procesado_por   uuid references auth.users(id)
);

create table pedido_woocommerce_lineas (
  id                  uuid primary key default gen_random_uuid(),
  pedido_id           uuid not null references pedidos_woocommerce(id) on delete cascade,
  wc_line_item_id     bigint not null,
  sku                 text not null default '',
  nombre_producto     text not null,
  cantidad            numeric(14,4) not null check (cantidad > 0),
  producto_id         uuid references productos(id),
  orden_produccion_id uuid references ordenes_produccion(id)
);

create index pedidos_woocommerce_revision_recibido_idx on pedidos_woocommerce(estado_revision, recibido_en desc);
create index pedido_woocommerce_lineas_pedido_idx       on pedido_woocommerce_lineas(pedido_id);

-- RLS: mismo patrón que facturas_compra (ver 20260721034412_rls_policies.sql) — sólo
-- política de lectura por rol; toda escritura pasa por supabaseAdmin (service role) desde
-- las API routes, nunca directo desde el cliente.
alter table pedidos_woocommerce        enable row level security;
alter table pedido_woocommerce_lineas  enable row level security;

create policy pedidos_woocommerce_select on pedidos_woocommerce for select
  using ((auth.jwt() -> 'app_metadata' ->> 'rol') in ('GERENTE','PRODUCCION'));
create policy pedido_woocommerce_lineas_select on pedido_woocommerce_lineas for select
  using ((auth.jwt() -> 'app_metadata' ->> 'rol') in ('GERENTE','PRODUCCION'));
