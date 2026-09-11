-- Agrega establecimiento y punto de emisión a configuracion_sri: faltaban.
-- Sin esto, cada factura de venta nueva se creaba con los defaults de la
-- columna (establecimiento='001', punto_emision='001' — ver
-- 20260801000000_facturas_venta_fase1.sql), sin importar cuál sea el punto
-- de emisión REAL que ya tiene la empresa registrado ante el SRI (acá,
-- 001-100 — ver las facturas 001-100-000000061/62 ya cargadas a mano). El
-- flujo de emisión automática (Fase 2, emitir/route.ts) usa el
-- establecimiento/punto_emision que ya trae la fila al crearla — nunca deja
-- elegir otro — así que sin este default corriendo, terminaba arrancando
-- una serie 001-001 paralela y falsa en vez de continuar la 001-100 real.
--
-- El default '100' de abajo es el valor real actual de MetalMAC — quien
-- vuelva a correr este seed en otro entorno lo cambia desde
-- Configuración → SRI, no hace falta otra migración para eso.

alter table configuracion_sri
  add column establecimiento text not null default '001' check (establecimiento ~ '^\d{3}$'),
  add column punto_emision   text not null default '100' check (punto_emision ~ '^\d{3}$');
