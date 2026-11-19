-- Carga el catálogo real de tallermac.com (14 productos) en el ERP, que ya es la
-- fuente de verdad del catálogo público (ver 20261113010000_retirar_woocommerce.sql:
-- productos_tienda_publica expone activo=true AND publicado_sitio=true). Datos
-- crawleados el 2026-11-19 para la auditoría SEO/visibilidad IA; precio_venta es el
-- precio de venta actual en tallermac.com hoy — el precio "antes" del descuento queda
-- solo como referencia histórica en la descripción, nunca en precio_venta.
--
-- publicado_sitio = true: se publican directo, cumpliendo "agregar y a la vez
-- publicar desde el ERP". imagen_urls queda vacío (default) — sin fotos todavía,
-- la vista pública los muestra igual, sin foto, hasta que el staff las suba.
--
-- Idempotente (ON CONFLICT DO NOTHING): re-correr esta migración no duplica filas.

insert into productos (codigo, nombre, descripcion, tipo, unidad_venta, precio_venta, activo, publicado_sitio) values
('SIGMA-32388', 'Lámpara colgante Merci I Black 32388 Sigma', 'Categoría: Lámparas Colgantes. Migrado de tallermac.com (antes $130).', 'PRODUCTO_TERMINADO', 'UNIDAD', 85, true, true),
('SIGMA-32392', 'Lámpara colgante Merci III Black-Gold 32392 Sigma', 'Categoría: Lámparas Colgantes. Migrado de tallermac.com (antes $250). URL de origen numérica (/product/678/) — requiere redirect 301 al migrar el sitio.', 'PRODUCTO_TERMINADO', 'UNIDAD', 180, true, true),
('SIGMA-32403', 'Lámpara de techo Merci II Black 32403 Sigma', 'Categoría: Lámparas Colgantes. Migrado de tallermac.com (antes $130). URL de origen numérica (/product/680/) — requiere redirect 301 al migrar el sitio.', 'PRODUCTO_TERMINADO', 'UNIDAD', 110, true, true),
('MUE-001', 'Sillón de exterior, metal + madera maciza', 'Categoría: Muebles para exterior. Migrado de tallermac.com (antes $370). URL de origen numérica (/product/687/) — requiere redirect 301 al migrar el sitio.', 'PRODUCTO_TERMINADO', 'UNIDAD', 300, true, true),
('MUE-002', 'Estantería decorativa de pared dorada', 'Categoría: Estantería. Migrado de tallermac.com (antes $550).', 'PRODUCTO_TERMINADO', 'UNIDAD', 490, true, true),
('MUE-003', 'Consola moderna con estantes de madera natural', 'Categoría: Recibidores. Migrado de tallermac.com (antes $300).', 'PRODUCTO_TERMINADO', 'UNIDAD', 250, true, true),
('MUE-004', 'Conjunto de picnic (mesa + bancos, madera y metal negro)', 'Categoría: Muebles para exterior. Migrado de tallermac.com (antes $650).', 'PRODUCTO_TERMINADO', 'UNIDAD', 570, true, true),
('MUE-005', 'Conjunto de mesa y sillas de comedor contemporáneo', 'Categoría: Mesa de comedor. Migrado de tallermac.com (antes $950).', 'PRODUCTO_TERMINADO', 'UNIDAD', 860, true, true),
('CCTV-001', 'Gabinete metálico para equipos de red', 'Categoría: Cajas Metálicas. Migrado de tallermac.com.', 'PRODUCTO_TERMINADO', 'UNIDAD', 75, true, true),
('CCTV-002', 'Soporte de cámara en acero inoxidable (brazo)', 'Categoría: Soportes para Cámaras. Migrado de tallermac.com.', 'PRODUCTO_TERMINADO', 'UNIDAD', 65, true, true),
('CCTV-003', 'Soporte de cámara de placa en acero inoxidable (base para poste)', 'Categoría: Soportes para Cámaras. Migrado de tallermac.com.', 'PRODUCTO_TERMINADO', 'UNIDAD', 25, true, true),
('CCTV-004', 'Brazo dual de 1m para cámaras CCTV con abrazaderas a poste', 'Categoría: Brazos para PTZ/Cámaras. Migrado de tallermac.com.', 'PRODUCTO_TERMINADO', 'UNIDAD', 30, true, true),
('CCTV-005', 'Soporte adaptador de montaje en poste para cámaras bullet CCTV', 'Categoría: Soportes para Cámaras. Migrado de tallermac.com.', 'PRODUCTO_TERMINADO', 'UNIDAD', 16, true, true),
('CCTV-006', 'Abrazadera de adaptación para cámara bala', 'Sin categoría ni descripción propia en el sitio original. Migrado de tallermac.com.', 'PRODUCTO_TERMINADO', 'UNIDAD', 25, true, true)
on conflict (codigo) do nothing;
