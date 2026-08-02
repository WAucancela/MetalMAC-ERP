-- Asigna el siguiente secuencial de factura de venta para un establecimiento +
-- punto de emisión, con lock — dos emisiones casi simultáneas no pueden terminar
-- calculando el mismo número (el SRI rechaza una clave de acceso duplicada, así que
-- esto no puede fallar en silencio como si nada). Mismo criterio de locking real que
-- ya usan reservar_materiales_bom/registrar_movimiento_inventario, pero con un
-- advisory lock en vez de `for update` porque acá no hay una fila existente que
-- bloquear — el "recurso" es el par (establecimiento, punto_emision) en sí.

create or replace function siguiente_secuencial_factura_venta(
  p_establecimiento text,
  p_punto_emision   text
) returns integer language plpgsql as $$
declare
  v_siguiente integer;
begin
  perform pg_advisory_xact_lock(hashtext('secuencial_venta:' || p_establecimiento || ':' || p_punto_emision));

  select coalesce(max(secuencial), 0) + 1 into v_siguiente
  from facturas_venta
  where establecimiento = p_establecimiento
    and punto_emision = p_punto_emision
    and secuencial is not null;

  return v_siguiente;
end $$;

revoke execute on function siguiente_secuencial_factura_venta(text, text) from public;
grant execute on function siguiente_secuencial_factura_venta(text, text) to service_role;
