-- Vista de solo lectura para el sitio público (tallermac-web): expone únicamente los
-- campos seguros de `productos` (nunca costos de BOM ni datos internos), y solo los
-- productos ya marcados para la tienda (wc_product_id no nulo = publicado) y activos.
-- Reemplaza la sincronización hacia WooCommerce: el sitio nuevo lee directo de aquí.
create view productos_tienda_publica as
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
  and wc_product_id is not null;

grant select on productos_tienda_publica to anon, authenticated;
