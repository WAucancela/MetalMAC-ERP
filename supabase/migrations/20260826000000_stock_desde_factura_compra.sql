-- Conecta las facturas de compra con el inventario, que hasta ahora eran dos
-- circuitos independientes: marcar una factura "Procesada" no tocaba `stock`
-- en absoluto — el material entraba solo si alguien además registraba un
-- movimiento manual de tipo ENTRADA por su cuenta. Esto generaba inventario
-- fantasma (factura procesada, stock en 0) cada vez que se olvidaba ese
-- segundo paso.
--
-- A partir de acá:
--   PENDIENTE -> PROCESADA  genera un movimiento ENTRADA por cada línea ya
--                            resuelta a un material (material_id not null —
--                            las líneas convertidas a gasto general nunca
--                            tienen material_id, así que quedan afuera solas).
--   PROCESADA -> ANULADA    revierte esas entradas con AJUSTE_NEGATIVO. Si
--                            para entonces el material ya se consumió (por
--                            ej. en una Orden de Producción) y no alcanza el
--                            stock disponible para revertir, la función
--                            aborta con STOCK_INSUFICIENTE_ANULACION — nunca
--                            deja el stock en negativo ni la factura a medio
--                            anular (todo o nada, misma transacción).
--
-- Devolución a proveedor (parcial, sin anular toda la factura) es una acción
-- aparte: registrar_devolucion_proveedor. Usa un tipo de movimiento nuevo,
-- DEVOLUCION_PROVEEDOR, en vez de reutilizar el DEVOLUCION que ya existía —
-- ese tipo está cableado para *sumar* stock (devolución de cliente, ver
-- registrar_movimiento_inventario en 20260721034417_rpc_bom_stock.sql), y acá
-- necesitamos lo contrario.

alter type tipo_movimiento add value if not exists 'DEVOLUCION_PROVEEDOR';

-- 1. PENDIENTE -> PROCESADA: genera las entradas de stock
create or replace function procesar_factura_compra(
  p_factura_id uuid,
  p_usuario_id uuid
) returns void language plpgsql as $$
declare
  v_factura record;
  v_linea   record;
  v_stock   record;
  v_cantidad numeric(14,6);
begin
  -- `for update` bloquea la fila de la factura: dos PATCH concurrentes al
  -- mismo estado no pueden terminar generando la entrada dos veces.
  select id, numero_factura, estado into v_factura
    from facturas_compra where id = p_factura_id for update;

  if not found then
    raise exception 'FACTURA_NO_ENCONTRADA' using detail = json_build_object('facturaId', p_factura_id)::text;
  end if;

  if v_factura.estado <> 'PENDIENTE' then
    raise exception 'ESTADO_INVALIDO' using detail = json_build_object(
      'facturaId', p_factura_id, 'estadoActual', v_factura.estado, 'esperado', 'PENDIENTE')::text;
  end if;

  update facturas_compra set estado = 'PROCESADA' where id = p_factura_id;

  -- Orden estable por material_id: mismo criterio anti-deadlock que
  -- reservar_materiales_bom cuando dos transacciones tocan varios materiales.
  for v_linea in
    select material_id, cantidad, cantidad_convertida, precio_unitario
    from factura_compra_lineas
    where factura_id = p_factura_id and material_id is not null
    order by material_id
  loop
    v_cantidad := coalesce(v_linea.cantidad_convertida, v_linea.cantidad);
    if v_cantidad <= 0 then continue; end if;

    select * into v_stock from stock where material_id = v_linea.material_id for update;
    if not found then
      raise exception 'MATERIAL_NO_ENCONTRADO' using detail = json_build_object('materialId', v_linea.material_id)::text;
    end if;

    update stock set
      cantidad_disponible = cantidad_disponible + v_cantidad,
      actualizado_en = now()
    where material_id = v_linea.material_id;

    insert into movimientos_inventario
      (material_id, tipo, cantidad, stock_anterior, stock_posterior, costo_unitario, documento_tipo, documento_id, numero_referencia, notas, usuario_id)
    values
      (v_linea.material_id, 'ENTRADA', v_cantidad, v_stock.cantidad_disponible, v_stock.cantidad_disponible + v_cantidad,
       v_linea.precio_unitario, 'FACTURA_COMPRA', p_factura_id, v_factura.numero_factura,
       'Entrada automática al procesar factura de compra ' || v_factura.numero_factura, p_usuario_id);
  end loop;
end $$;

-- 2. ANULADA: si la factura ya estaba PROCESADA (y por lo tanto ya generó
--    entradas), revierte cada una antes de anular. Si estaba en PENDIENTE,
--    nunca tocó el stock, así que anula sin más.
create or replace function anular_factura_compra(
  p_factura_id uuid,
  p_usuario_id uuid
) returns void language plpgsql as $$
declare
  v_factura record;
  v_linea   record;
  v_stock   record;
  v_cantidad numeric(14,6);
begin
  select id, numero_factura, estado into v_factura
    from facturas_compra where id = p_factura_id for update;

  if not found then
    raise exception 'FACTURA_NO_ENCONTRADA' using detail = json_build_object('facturaId', p_factura_id)::text;
  end if;

  if v_factura.estado = 'ANULADA' then
    raise exception 'FACTURA_YA_ANULADA' using detail = json_build_object('facturaId', p_factura_id)::text;
  end if;

  if v_factura.estado = 'PROCESADA' then
    for v_linea in
      select material_id, cantidad, cantidad_convertida
      from factura_compra_lineas
      where factura_id = p_factura_id and material_id is not null
      order by material_id
    loop
      v_cantidad := coalesce(v_linea.cantidad_convertida, v_linea.cantidad);
      if v_cantidad <= 0 then continue; end if;

      select * into v_stock from stock where material_id = v_linea.material_id for update;
      if not found then
        raise exception 'MATERIAL_NO_ENCONTRADO' using detail = json_build_object('materialId', v_linea.material_id)::text;
      end if;

      if v_stock.cantidad_disponible < v_cantidad then
        -- Todo-o-nada: aborta la transacción completa, la factura sigue PROCESADA.
        -- El caso típico es que el material ya se consumió en una OP — hay que
        -- resolverlo a mano (ajuste manual o revisar la OP) antes de anular.
        raise exception 'STOCK_INSUFICIENTE_ANULACION' using detail = json_build_object(
          'materialId', v_linea.material_id, 'disponible', v_stock.cantidad_disponible, 'solicitado', v_cantidad)::text;
      end if;

      update stock set
        cantidad_disponible = cantidad_disponible - v_cantidad,
        actualizado_en = now()
      where material_id = v_linea.material_id;

      insert into movimientos_inventario
        (material_id, tipo, cantidad, stock_anterior, stock_posterior, costo_unitario, documento_tipo, documento_id, numero_referencia, notas, usuario_id)
      values
        (v_linea.material_id, 'AJUSTE_NEGATIVO', v_cantidad, v_stock.cantidad_disponible, v_stock.cantidad_disponible - v_cantidad,
         0, 'FACTURA_COMPRA', p_factura_id, v_factura.numero_factura,
         'Reversión por anulación de factura de compra ' || v_factura.numero_factura, p_usuario_id);
    end loop;
  end if;

  update facturas_compra set estado = 'ANULADA' where id = p_factura_id;
end $$;

-- 3. Devolución a proveedor — parcial, sin anular toda la factura. Solo
--    sobre facturas ya PROCESADAS (no se puede devolver lo que nunca entró).
--    No lleva registro de cuánto se devolvió acumulado por línea todavía —
--    igual que la reversión de arriba, el guardia real es el stock
--    disponible: no se puede devolver más de lo que hoy hay en bodega.
create or replace function registrar_devolucion_proveedor(
  p_factura_id uuid,
  p_material_id uuid,
  p_cantidad   numeric,
  p_usuario_id uuid
) returns uuid language plpgsql as $$
declare
  v_factura record;
  v_stock   record;
  v_mov_id  uuid;
begin
  if p_cantidad <= 0 then
    raise exception 'CANTIDAD_INVALIDA' using detail = p_cantidad::text;
  end if;

  select id, numero_factura, estado into v_factura
    from facturas_compra where id = p_factura_id for update;

  if not found then
    raise exception 'FACTURA_NO_ENCONTRADA' using detail = json_build_object('facturaId', p_factura_id)::text;
  end if;

  if v_factura.estado <> 'PROCESADA' then
    raise exception 'ESTADO_INVALIDO' using detail = json_build_object(
      'facturaId', p_factura_id, 'estadoActual', v_factura.estado, 'esperado', 'PROCESADA')::text;
  end if;

  select * into v_stock from stock where material_id = p_material_id for update;
  if not found then
    raise exception 'MATERIAL_NO_ENCONTRADO' using detail = json_build_object('materialId', p_material_id)::text;
  end if;

  if v_stock.cantidad_disponible < p_cantidad then
    raise exception 'STOCK_INSUFICIENTE_DEVOLUCION' using detail = json_build_object(
      'materialId', p_material_id, 'disponible', v_stock.cantidad_disponible, 'solicitado', p_cantidad)::text;
  end if;

  update stock set
    cantidad_disponible = cantidad_disponible - p_cantidad,
    actualizado_en = now()
  where material_id = p_material_id;

  insert into movimientos_inventario
    (material_id, tipo, cantidad, stock_anterior, stock_posterior, costo_unitario, documento_tipo, documento_id, numero_referencia, notas, usuario_id)
  values
    (p_material_id, 'DEVOLUCION_PROVEEDOR', p_cantidad, v_stock.cantidad_disponible, v_stock.cantidad_disponible - p_cantidad,
     0, 'FACTURA_COMPRA', p_factura_id, v_factura.numero_factura,
     'Devolución a proveedor sobre factura ' || v_factura.numero_factura, p_usuario_id)
  returning id into v_mov_id;

  return v_mov_id;
end $$;

revoke execute on function procesar_factura_compra(uuid, uuid) from public;
revoke execute on function anular_factura_compra(uuid, uuid) from public;
revoke execute on function registrar_devolucion_proveedor(uuid, uuid, numeric, uuid) from public;
grant execute on function procesar_factura_compra(uuid, uuid) to service_role;
grant execute on function anular_factura_compra(uuid, uuid) to service_role;
grant execute on function registrar_devolucion_proveedor(uuid, uuid, numeric, uuid) to service_role;
