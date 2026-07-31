-- Dos RPC para las mutaciones de pedidos_woocommerce que hacían varias llamadas
-- PostgREST separadas (no atómicas) desde las API routes:
--
-- 1. reemplazar_lineas_pendientes_pedido_woocommerce: el webhook
--    (app/api/webhooks/woocommerce/route.ts) hacía un delete y un insert como dos
--    llamadas independientes — si el insert fallaba después de un delete exitoso, el
--    pedido quedaba sin líneas pendientes hasta el siguiente reintento de WooCommerce.
--    Con esta función, delete+insert corren en la transacción implícita de la función.
--
-- 2. convertir_linea_pedido_woocommerce: el endpoint de conversión
--    (app/api/pedidos-woocommerce/[id]/lineas/[lineaId]/convertir/route.ts) leía
--    `orden_produccion_id` y recién después escribía, sin lock — dos requests casi
--    simultáneos sobre la misma línea (doble click, dos pestañas) podían pasar ambos
--    el check y crear dos órdenes de producción para la misma línea. `for update`
--    sobre la fila de la línea serializa los intentos concurrentes, igual que el
--    patrón ya usado en reservar_materiales_bom/registrar_movimiento_inventario.

create or replace function reemplazar_lineas_pendientes_pedido_woocommerce(
  p_pedido_id uuid,
  p_lineas    jsonb
) returns void language plpgsql as $$
begin
  delete from pedido_woocommerce_lineas
  where pedido_id = p_pedido_id and orden_produccion_id is null;

  insert into pedido_woocommerce_lineas (pedido_id, wc_line_item_id, sku, nombre_producto, cantidad, producto_id)
  select
    p_pedido_id,
    (l->>'wcLineItemId')::bigint,
    coalesce(l->>'sku', ''),
    l->>'nombreProducto',
    (l->>'cantidad')::numeric,
    nullif(l->>'productoId', '')::uuid
  from jsonb_array_elements(p_lineas) as l;
end $$;

create or replace function convertir_linea_pedido_woocommerce(
  p_linea_id      uuid,
  p_pedido_id     uuid,
  p_producto_id   uuid,
  p_cantidad      numeric,
  p_fecha_entrega date,
  p_proyecto_id   uuid,
  p_notas         text,
  p_usuario_id    uuid
) returns ordenes_produccion language plpgsql as $$
declare
  v_linea      record;
  v_orden      ordenes_produccion;
  v_pendientes integer;
begin
  select * into v_linea from pedido_woocommerce_lineas
    where id = p_linea_id and pedido_id = p_pedido_id
    for update;

  if not found then
    raise exception 'LINEA_NO_ENCONTRADA';
  end if;

  if v_linea.orden_produccion_id is not null then
    raise exception 'LINEA_YA_CONVERTIDA';
  end if;

  if not exists (select 1 from productos where id = p_producto_id) then
    raise exception 'PRODUCTO_NO_ENCONTRADO';
  end if;

  -- Propaga BOM_NO_ENCONTRADO tal cual si el producto no tiene BOM configurado.
  v_orden := crear_orden_produccion(p_producto_id, p_cantidad, p_fecha_entrega, p_proyecto_id, p_notas, p_usuario_id);

  update pedido_woocommerce_lineas
    set producto_id = p_producto_id, orden_produccion_id = v_orden.id
    where id = p_linea_id;

  select count(*) into v_pendientes from pedido_woocommerce_lineas
    where pedido_id = p_pedido_id and orden_produccion_id is null;

  if v_pendientes = 0 then
    update pedidos_woocommerce
      set estado_revision = 'CONVERTIDO', procesado_en = now(), procesado_por = p_usuario_id
      where id = p_pedido_id;
  end if;

  return v_orden;
end $$;

-- Mismo criterio de defensa en profundidad que grants_and_permissions.sql: nunca
-- invocables directamente vía PostgREST /rpc/* por un cliente autenticado.
revoke execute on function reemplazar_lineas_pendientes_pedido_woocommerce(uuid, jsonb) from public;
revoke execute on function convertir_linea_pedido_woocommerce(uuid, uuid, uuid, numeric, date, uuid, text, uuid) from public;

grant execute on function reemplazar_lineas_pendientes_pedido_woocommerce(uuid, jsonb) to service_role;
grant execute on function convertir_linea_pedido_woocommerce(uuid, uuid, uuid, numeric, date, uuid, text, uuid) to service_role;
