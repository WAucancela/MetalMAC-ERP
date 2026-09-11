-- Arregla 3 huecos encontrados en code review sobre
-- 20260826000000_stock_desde_factura_compra.sql, antes de mergear:
--
-- 1. Una línea "sin resolver" al momento de procesar la factura nunca
--    generaba su entrada, ni siquiera si se mapeaba a un material después
--    (MapearMaterialPopover no chequea el estado de la factura) — el mismo
--    "inventario fantasma" que esa migración vino a eliminar, por otra
--    puerta. Se agrega `stock_registrado` para saber, por línea, si ya
--    generó su movimiento — y una función nueva que lo hace al mapear una
--    línea de una factura que ya está PROCESADA.
-- 2. `registrar_devolucion_proveedor` no verificaba que el material
--    devuelto perteneciera realmente a esa factura — solo lo filtraba la
--    UI (RegistrarDevolucionDialog), nunca el servidor.

alter table factura_compra_lineas
  add column stock_registrado boolean not null default false;

-- Backfill: las líneas de facturas ya PROCESADAS con material resuelto ya
-- generaron su entrada en la versión anterior de procesar_factura_compra —
-- se marcan como registradas para que anular_factura_compra (que ahora
-- filtra por esta columna, no por material_id) las siga revirtiendo bien.
update factura_compra_lineas fcl
set stock_registrado = true
from facturas_compra fc
where fc.id = fcl.factura_id
  and fc.estado = 'PROCESADA'
  and fcl.material_id is not null;

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

  for v_linea in
    select id, material_id, cantidad, cantidad_convertida, precio_unitario
    from factura_compra_lineas
    where factura_id = p_factura_id and material_id is not null and not stock_registrado
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

    update factura_compra_lineas set stock_registrado = true where id = v_linea.id;

    insert into movimientos_inventario
      (material_id, tipo, cantidad, stock_anterior, stock_posterior, costo_unitario, documento_tipo, documento_id, numero_referencia, notas, usuario_id)
    values
      (v_linea.material_id, 'ENTRADA', v_cantidad, v_stock.cantidad_disponible, v_stock.cantidad_disponible + v_cantidad,
       v_linea.precio_unitario, 'FACTURA_COMPRA', p_factura_id, v_factura.numero_factura,
       'Entrada automática al procesar factura de compra ' || v_factura.numero_factura, p_usuario_id);
  end loop;
end $$;

-- Complemento de procesar_factura_compra: si una línea seguía "sin resolver"
-- cuando se procesó la factura (por eso el loop de arriba la saltó), y
-- alguien la mapea a un material más tarde con la factura ya PROCESADA, acá
-- se genera esa entrada que quedó pendiente. Si la factura todavía está
-- PENDIENTE, no hace nada — procesar_factura_compra se va a encargar en su
-- momento. Si la línea ya tenía stock_registrado (se está re-mapeando a otro
-- material), tampoco hace nada — cambiar de material una línea cuyo stock ya
-- entró necesita un ajuste manual a propósito, para no arriesgar descontar
-- mal el material anterior.
create or replace function entrar_stock_linea_mapeada(
  p_linea_id   uuid,
  p_usuario_id uuid
) returns void language plpgsql as $$
declare
  v_linea   record;
  v_factura record;
  v_stock   record;
  v_cantidad numeric(14,6);
begin
  select id, factura_id, material_id, cantidad, cantidad_convertida, precio_unitario, stock_registrado
    into v_linea
    from factura_compra_lineas where id = p_linea_id for update;

  if not found then
    raise exception 'LINEA_NO_ENCONTRADA' using detail = json_build_object('lineaId', p_linea_id)::text;
  end if;

  if v_linea.stock_registrado or v_linea.material_id is null then
    return;
  end if;

  select id, numero_factura, estado into v_factura
    from facturas_compra where id = v_linea.factura_id for update;

  if v_factura.estado <> 'PROCESADA' then
    return;
  end if;

  v_cantidad := coalesce(v_linea.cantidad_convertida, v_linea.cantidad);
  if v_cantidad <= 0 then return; end if;

  select * into v_stock from stock where material_id = v_linea.material_id for update;
  if not found then
    raise exception 'MATERIAL_NO_ENCONTRADO' using detail = json_build_object('materialId', v_linea.material_id)::text;
  end if;

  update stock set
    cantidad_disponible = cantidad_disponible + v_cantidad,
    actualizado_en = now()
  where material_id = v_linea.material_id;

  update factura_compra_lineas set stock_registrado = true where id = v_linea.id;

  insert into movimientos_inventario
    (material_id, tipo, cantidad, stock_anterior, stock_posterior, costo_unitario, documento_tipo, documento_id, numero_referencia, notas, usuario_id)
  values
    (v_linea.material_id, 'ENTRADA', v_cantidad, v_stock.cantidad_disponible, v_stock.cantidad_disponible + v_cantidad,
     v_linea.precio_unitario, 'FACTURA_COMPRA', v_factura.id, v_factura.numero_factura,
     'Entrada automática al mapear línea de factura de compra ya procesada ' || v_factura.numero_factura, p_usuario_id);
end $$;

-- anular_factura_compra: revierte por stock_registrado, no por material_id —
-- una línea puede tener material_id sin haber generado nunca su entrada
-- (factura anulada directo desde PENDIENTE, o mapeada después de anulada).
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
      select id, material_id, cantidad, cantidad_convertida
      from factura_compra_lineas
      where factura_id = p_factura_id and stock_registrado
      order by material_id
    loop
      v_cantidad := coalesce(v_linea.cantidad_convertida, v_linea.cantidad);
      if v_cantidad <= 0 then continue; end if;

      select * into v_stock from stock where material_id = v_linea.material_id for update;
      if not found then
        raise exception 'MATERIAL_NO_ENCONTRADO' using detail = json_build_object('materialId', v_linea.material_id)::text;
      end if;

      if v_stock.cantidad_disponible < v_cantidad then
        raise exception 'STOCK_INSUFICIENTE_ANULACION' using detail = json_build_object(
          'materialId', v_linea.material_id, 'disponible', v_stock.cantidad_disponible, 'solicitado', v_cantidad)::text;
      end if;

      update stock set
        cantidad_disponible = cantidad_disponible - v_cantidad,
        actualizado_en = now()
      where material_id = v_linea.material_id;

      update factura_compra_lineas set stock_registrado = false where id = v_linea.id;

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

-- registrar_devolucion_proveedor: valida que el material devuelto
-- pertenezca realmente a una línea de esta factura — antes solo lo
-- restringía el <Select> del diálogo, nunca el servidor.
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

  if not exists (
    select 1 from factura_compra_lineas
    where factura_id = p_factura_id and material_id = p_material_id
  ) then
    raise exception 'MATERIAL_NO_PERTENECE_FACTURA' using detail = json_build_object(
      'facturaId', p_factura_id, 'materialId', p_material_id)::text;
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

revoke execute on function entrar_stock_linea_mapeada(uuid, uuid) from public;
grant execute on function entrar_stock_linea_mapeada(uuid, uuid) to service_role;
