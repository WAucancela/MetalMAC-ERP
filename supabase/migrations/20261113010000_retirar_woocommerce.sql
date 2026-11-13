-- Se retira por completo la integración con WooCommerce (tallermac.com): el sitio
-- público ahora es tallermac-web, que lee/escribe directo contra esta misma base —
-- ya no hace falta un sistema intermediario ni recibir pedidos por webhook.
-- Confirmado explícitamente con el dueño del negocio (2026-11-13) antes de aplicar
-- esto a producción: el WordPress/WooCommerce viejo nunca llegó a recibir pedidos
-- reales (estaba en fase de desarrollo), así que no hay datos de producción que migrar.

drop function if exists convertir_linea_pedido_woocommerce(uuid, uuid, uuid, numeric, date, uuid, text, uuid);
drop function if exists reemplazar_lineas_pendientes_pedido_woocommerce(uuid, jsonb);

drop table if exists pedido_woocommerce_lineas;
drop table if exists pedidos_woocommerce;
drop type if exists estado_revision_pedido;

-- La vista depende de wc_product_id (su WHERE) — se retira acá y se recrea al final
-- ya apuntando a publicado_sitio.
drop view if exists productos_tienda_publica;

alter table productos drop column if exists wc_product_id;
alter table productos drop column if exists wc_sincronizado_en;

comment on column productos.imagen_urls is 'URLs públicas de las imágenes del producto para mostrar en el sitio público (tallermac-web), una por línea. Vacío = sin imágenes todavía.';

-- Reemplaza wc_product_id como la señal de "visible en el sitio público": ahora es
-- una decisión directa del staff (botón en el ERP), no un efecto secundario de
-- publicar en WooCommerce.
alter table productos add column publicado_sitio boolean not null default false;

create or replace view productos_tienda_publica as
select
  id,
  codigo,
  nombre,
  descripcion,
  precio_venta,
  unidad_venta,
  imagen_urls
from productos
where activo = true
  and publicado_sitio = true;
