-- Publicación de productos del ERP en la tienda WooCommerce (tallermac.com).
--
-- Sentido inverso al de pedidos_woocommerce: acá el ERP es el origen de verdad del
-- producto y lo empuja hacia WooCommerce (POST/PUT /wp-json/wc/v3/products), no al
-- revés. wc_product_id identifica el producto ya creado en WooCommerce para decidir
-- si la próxima publicación es un alta o una actualización; null = nunca publicado.
--
-- No hay cantidad de stock: la fabricación es a pedido (ver órdenes de producción),
-- así que un producto publicado siempre se marca "disponible" en WooCommerce en vez
-- de intentar sincronizar una cantidad que no existe en este modelo.
alter table productos
  add column imagen_url          text not null default '',
  add column wc_product_id       bigint,
  add column wc_sincronizado_en  timestamptz;

comment on column productos.imagen_url is 'URL pública de la imagen principal para publicar en WooCommerce (pegada a mano — el ERP no aloja imágenes).';
comment on column productos.wc_product_id is 'ID del producto en WooCommerce una vez publicado; null = nunca publicado en la tienda.';
comment on column productos.wc_sincronizado_en is 'Fecha/hora de la última publicación/actualización exitosa hacia WooCommerce.';

-- Un producto de WooCommerce solo puede estar enlazado a un producto del ERP.
create unique index productos_wc_product_id_idx on productos(wc_product_id) where wc_product_id is not null;
