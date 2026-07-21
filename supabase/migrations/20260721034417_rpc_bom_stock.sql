-- Funciones plpgsql para las secciones críticas de mutación de stock. Usan `for update`
-- para locking real (equivalente a las Firestore transactions de bom.service.ts /
-- inventario.service.ts). Errores de dominio se señalan con RAISE EXCEPTION usando una
-- etiqueta estable como mensaje + un DETAIL en JSON, que la capa TS traduce de vuelta a
-- las clases de error existentes (StockInsuficienteError, MaterialNoEncontradoError, etc.)
-- vía lib/services/rpc-errors.ts.

-- 1. Reservar materiales de un BOM para una OP (reemplaza bom.service.ts reservarMaterialesBOM)
create or replace function reservar_materiales_bom(
  p_orden_id    uuid,
  p_producto_id uuid,
  p_unidades    numeric,
  p_usuario_id  uuid
) returns jsonb language plpgsql as $$
declare
  v_linea record;
  v_stock record;
  v_costo_unitario numeric(14,4);
  v_requerido numeric(14,6);
  v_resultado jsonb := '[]'::jsonb;
begin
  -- Orden estable por material_id: evita deadlocks entre reservas concurrentes que
  -- solapen el mismo conjunto de materiales.
  for v_linea in
    select bl.material_id, bl.cantidad_base, bl.factor_merma
    from bom_lineas bl
    where bl.bom_producto_id = p_producto_id
    order by bl.material_id
  loop
    select s.*, m.costo_unitario into v_stock
      from stock s join materiales m on m.id = s.material_id
      where s.material_id = v_linea.material_id
      for update of s;

    if not found then
      raise exception 'MATERIAL_NO_ENCONTRADO' using detail = json_build_object('materialId', v_linea.material_id)::text;
    end if;

    v_requerido := round(v_linea.cantidad_base * v_linea.factor_merma * p_unidades, 6);
    -- Fuente correcta del costo: materiales.costo_unitario (no stock — el `stock` de Firestore
    -- nunca tuvo ese campo, y `reservarMaterialesBOM` grababa costoUnitarioAlMomento=0 en la práctica).
    v_costo_unitario := v_stock.costo_unitario;

    if v_requerido > v_stock.cantidad_disponible then
      raise exception 'STOCK_INSUFICIENTE_OP' using detail = json_build_object(
        'materialId', v_linea.material_id, 'requerido', v_requerido, 'disponible', v_stock.cantidad_disponible
      )::text;
    end if;

    update stock set
      cantidad_disponible = cantidad_disponible - v_requerido,
      cantidad_reservada  = cantidad_reservada + v_requerido,
      actualizado_en = now()
    where material_id = v_linea.material_id;

    insert into movimientos_inventario
      (material_id, tipo, cantidad, stock_anterior, stock_posterior, costo_unitario, documento_tipo, documento_id, numero_referencia, notas, usuario_id)
    values
      (v_linea.material_id, 'RESERVA', v_requerido, v_stock.cantidad_disponible, v_stock.cantidad_disponible - v_requerido,
       v_costo_unitario, 'ORDEN_PRODUCCION', p_orden_id, p_orden_id::text, 'Reserva para OP ' || p_orden_id, p_usuario_id);

    insert into orden_materiales_reservados (orden_id, material_id, cantidad_reservada, costo_unitario_al_momento)
    values (p_orden_id, v_linea.material_id, v_requerido, v_costo_unitario);

    v_resultado := v_resultado || jsonb_build_object(
      'materialId', v_linea.material_id, 'cantidadReservada', v_requerido, 'costoUnitarioAlMomento', v_costo_unitario);
  end loop;

  -- Cualquier excepción arriba revierte todo lo hecho en esta invocación (all-or-nothing).
  return v_resultado;
end $$;

-- 2. Liberar materiales reservados (OP cancelada) — reemplaza liberarMaterialesBOM
create or replace function liberar_materiales_bom(
  p_orden_id   uuid,
  p_usuario_id uuid
) returns void language plpgsql as $$
declare
  v_mr record;
  v_stock record;
  v_a_liberar numeric(14,6);
begin
  for v_mr in
    select * from orden_materiales_reservados where orden_id = p_orden_id order by material_id
  loop
    select * into v_stock from stock where material_id = v_mr.material_id for update;
    if not found then continue; end if;

    -- Clamp defensivo: nunca libera más de lo que hay realmente reservado (protege contra doble-liberación).
    v_a_liberar := least(v_mr.cantidad_reservada, v_stock.cantidad_reservada);
    -- Si ya no queda nada reservado (p.ej. liberado por otra vía), no-op: movimientos_inventario
    -- exige cantidad > 0, así que una fila en cero se salta en vez de fallar.
    if v_a_liberar <= 0 then continue; end if;

    update stock set
      cantidad_disponible = cantidad_disponible + v_a_liberar,
      cantidad_reservada  = cantidad_reservada - v_a_liberar,
      actualizado_en = now()
    where material_id = v_mr.material_id;

    insert into movimientos_inventario
      (material_id, tipo, cantidad, stock_anterior, stock_posterior, costo_unitario, documento_tipo, documento_id, numero_referencia, notas, usuario_id)
    values
      (v_mr.material_id, 'LIBERACION', v_a_liberar, v_stock.cantidad_disponible, v_stock.cantidad_disponible + v_a_liberar,
       v_mr.costo_unitario_al_momento, 'ORDEN_PRODUCCION', p_orden_id, p_orden_id::text,
       'Liberación por cancelación de OP ' || p_orden_id, p_usuario_id);
  end loop;
end $$;

-- 3. Consumir materiales reservados (OP completada) — reemplaza consumirMaterialesBOM
create or replace function consumir_materiales_bom(
  p_orden_id   uuid,
  p_usuario_id uuid
) returns void language plpgsql as $$
declare
  v_mr record;
  v_stock record;
  v_a_consumir numeric(14,6);
begin
  for v_mr in
    select * from orden_materiales_reservados where orden_id = p_orden_id order by material_id
  loop
    select * into v_stock from stock where material_id = v_mr.material_id for update;
    if not found then continue; end if;

    v_a_consumir := least(v_mr.cantidad_reservada, v_stock.cantidad_reservada);
    if v_a_consumir <= 0 then continue; end if;

    -- `cantidad_disponible` ya se decrementó al reservar; consumir sólo baja `cantidad_reservada`.
    update stock set
      cantidad_reservada = cantidad_reservada - v_a_consumir,
      actualizado_en = now()
    where material_id = v_mr.material_id;

    -- stock_anterior = stock_posterior = cantidad_disponible actual, intencional: `disponible`
    -- genuinamente no cambia en este paso (ya bajó en la reserva). No es un bug, se documenta
    -- aquí para que un futuro lector no lo confunda con un error de cálculo.
    insert into movimientos_inventario
      (material_id, tipo, cantidad, stock_anterior, stock_posterior, costo_unitario, documento_tipo, documento_id, numero_referencia, notas, usuario_id)
    values
      (v_mr.material_id, 'SALIDA', v_a_consumir, v_stock.cantidad_disponible, v_stock.cantidad_disponible,
       v_mr.costo_unitario_al_momento, 'ORDEN_PRODUCCION', p_orden_id, p_orden_id::text,
       'Consumo por completación de OP ' || p_orden_id, p_usuario_id);
  end loop;
end $$;

-- 4. Movimiento manual de inventario (reemplaza inventario.service.ts registrarMovimiento)
create or replace function registrar_movimiento_inventario(
  p_material_id     uuid,
  p_tipo            tipo_movimiento,
  p_cantidad        numeric,
  p_costo_unitario  numeric,
  p_documento_tipo  tipo_documento,
  p_documento_id    uuid,
  p_numero_referencia text,
  p_notas           text,
  p_usuario_id      uuid
) returns uuid language plpgsql as $$
declare
  v_stock record;
  v_disponible numeric(14,6);
  v_reservada  numeric(14,6);
  v_lib numeric(14,6);
  v_mov_id uuid;
begin
  if p_cantidad <= 0 then
    raise exception 'CANTIDAD_INVALIDA' using detail = p_cantidad::text;
  end if;

  select * into v_stock from stock where material_id = p_material_id for update;
  if not found then
    raise exception 'MATERIAL_NO_ENCONTRADO' using detail = json_build_object('materialId', p_material_id)::text;
  end if;

  v_disponible := v_stock.cantidad_disponible;
  v_reservada  := v_stock.cantidad_reservada;

  if p_tipo in ('SALIDA','AJUSTE_NEGATIVO','MERMA','RESERVA') then
    if v_disponible < p_cantidad then
      raise exception 'STOCK_INSUFICIENTE' using detail = json_build_object(
        'materialId', p_material_id, 'disponible', v_disponible, 'solicitado', p_cantidad)::text;
    end if;
    v_disponible := v_disponible - p_cantidad;
    if p_tipo = 'RESERVA' then
      v_reservada := v_reservada + p_cantidad;
    end if;
  elsif p_tipo = 'LIBERACION' then
    v_lib := least(p_cantidad, v_reservada);
    v_reservada  := v_reservada - v_lib;
    v_disponible := v_disponible + v_lib;
  else -- ENTRADA, AJUSTE_POSITIVO, DEVOLUCION
    v_disponible := v_disponible + p_cantidad;
  end if;

  update stock set
    cantidad_disponible = v_disponible,
    cantidad_reservada  = v_reservada,
    actualizado_en = now()
  where material_id = p_material_id;

  insert into movimientos_inventario
    (material_id, tipo, cantidad, stock_anterior, stock_posterior, costo_unitario, documento_tipo, documento_id, numero_referencia, notas, usuario_id)
  values
    (p_material_id, p_tipo, p_cantidad, v_stock.cantidad_disponible, v_disponible, p_costo_unitario,
     p_documento_tipo, p_documento_id, p_numero_referencia, coalesce(p_notas, ''), p_usuario_id)
  returning id into v_mov_id;

  return v_mov_id;
end $$;
