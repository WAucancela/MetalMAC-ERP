-- Un producto puede necesitar varias fotos al publicarse en WooCommerce (distintos
-- ángulos, detalle, instalación), no solo una. Se mantiene como un único campo de
-- texto (una URL por línea) en vez de una tabla aparte — el volumen es bajísimo
-- (unas pocas URLs por producto) y no justifica el join.
alter table productos rename column imagen_url to imagen_urls;

comment on column productos.imagen_urls is 'URLs públicas de las imágenes para publicar en WooCommerce, una por línea. Vacío = sin imágenes todavía (la publicación es posible igual, pero el producto sale sin foto).';
