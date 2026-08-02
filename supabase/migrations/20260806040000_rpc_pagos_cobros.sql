-- Registrar un pago/cobro y, si corresponde, su movimiento bancario asociado,
-- de forma atómica — mismo criterio de lock real (`for update`) que
-- reservar_materiales_bom: evita que dos pagos casi simultáneos dejen pasar un
-- monto que en conjunto supera el saldo pendiente de la factura.

create or replace function registrar_pago_compra(
  p_factura_compra_id  uuid,
  p_monto              numeric,
  p_fecha              date,
  p_metodo_pago        text,
  p_referencia         text,
  p_cuenta_bancaria_id uuid,
  p_notas              text,
  p_usuario_id         uuid
) returns pagos_factura_compra language plpgsql as $$
declare
  v_factura record;
  v_pagado  numeric(14,4);
  v_saldo   numeric(14,4);
  v_pago    pagos_factura_compra;
begin
  select * into v_factura from facturas_compra where id = p_factura_compra_id for update;
  if not found then
    raise exception 'FACTURA_NO_ENCONTRADA' using detail = json_build_object('facturaCompraId', p_factura_compra_id)::text;
  end if;

  select coalesce(sum(monto), 0) into v_pagado from pagos_factura_compra where factura_compra_id = p_factura_compra_id;
  v_saldo := v_factura.total - v_pagado;

  if p_monto > v_saldo then
    raise exception 'SALDO_INSUFICIENTE' using detail = json_build_object('saldo', v_saldo, 'monto', p_monto)::text;
  end if;

  insert into pagos_factura_compra
    (factura_compra_id, monto, fecha, metodo_pago, referencia, cuenta_bancaria_id, notas, creado_por)
  values
    (p_factura_compra_id, p_monto, p_fecha, coalesce(p_metodo_pago, ''), coalesce(p_referencia, ''),
     p_cuenta_bancaria_id, coalesce(p_notas, ''), p_usuario_id)
  returning * into v_pago;

  if p_cuenta_bancaria_id is not null then
    insert into movimientos_bancarios (cuenta_bancaria_id, tipo, monto, fecha, descripcion, creado_por)
    values (p_cuenta_bancaria_id, 'PAGO_PROVEEDOR', p_monto, p_fecha,
            'Pago factura ' || coalesce(v_factura.numero_factura, p_factura_compra_id::text), p_usuario_id);
  end if;

  return v_pago;
end $$;

create or replace function registrar_cobro_venta(
  p_factura_venta_id   uuid,
  p_monto              numeric,
  p_fecha              date,
  p_metodo_pago        text,
  p_referencia         text,
  p_cuenta_bancaria_id uuid,
  p_notas              text,
  p_usuario_id         uuid
) returns cobros_factura_venta language plpgsql as $$
declare
  v_factura record;
  v_cobrado numeric(14,4);
  v_saldo   numeric(14,4);
  v_cobro   cobros_factura_venta;
begin
  select * into v_factura from facturas_venta where id = p_factura_venta_id for update;
  if not found then
    raise exception 'FACTURA_NO_ENCONTRADA' using detail = json_build_object('facturaVentaId', p_factura_venta_id)::text;
  end if;

  select coalesce(sum(monto), 0) into v_cobrado from cobros_factura_venta where factura_venta_id = p_factura_venta_id;
  v_saldo := v_factura.total - v_cobrado;

  if p_monto > v_saldo then
    raise exception 'SALDO_INSUFICIENTE' using detail = json_build_object('saldo', v_saldo, 'monto', p_monto)::text;
  end if;

  insert into cobros_factura_venta
    (factura_venta_id, monto, fecha, metodo_pago, referencia, cuenta_bancaria_id, notas, creado_por)
  values
    (p_factura_venta_id, p_monto, p_fecha, coalesce(p_metodo_pago, ''), coalesce(p_referencia, ''),
     p_cuenta_bancaria_id, coalesce(p_notas, ''), p_usuario_id)
  returning * into v_cobro;

  if p_cuenta_bancaria_id is not null then
    insert into movimientos_bancarios (cuenta_bancaria_id, tipo, monto, fecha, descripcion, creado_por)
    values (p_cuenta_bancaria_id, 'COBRO_CLIENTE', p_monto, p_fecha,
            'Cobro factura ' || coalesce(v_factura.numero_factura, p_factura_venta_id::text), p_usuario_id);
  end if;

  return v_cobro;
end $$;

revoke execute on function registrar_pago_compra(uuid, numeric, date, text, text, uuid, text, uuid) from public;
revoke execute on function registrar_cobro_venta(uuid, numeric, date, text, text, uuid, text, uuid) from public;
grant execute on function registrar_pago_compra(uuid, numeric, date, text, text, uuid, text, uuid) to service_role;
grant execute on function registrar_cobro_venta(uuid, numeric, date, text, text, uuid, text, uuid) to service_role;
