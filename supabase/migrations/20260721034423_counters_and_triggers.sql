-- Contadores anuales (OP-YYYY-NNNN / PRY-YYYY-NNNN). El incremento del contador y el
-- insert de la fila viven en la MISMA función = una sola transacción implícita: si el
-- insert falla, el contador también se revierte, cerrando el gap-risk que existía en
-- Firestore (generarCodigoOP()/generarCodigoProyecto() corrían en una transacción separada
-- de la creación del documento).

create table contadores_anuales (
  clave     text primary key,   -- 'OP-2026' / 'PRY-2026'
  anio      integer not null,
  secuencia integer not null default 0
);

create function siguiente_secuencia_anual(p_prefijo text, p_anio integer) returns integer language plpgsql as $$
declare
  v_seq integer;
begin
  insert into contadores_anuales (clave, anio, secuencia) values (p_prefijo || '-' || p_anio, p_anio, 1)
  on conflict (clave) do update set secuencia = contadores_anuales.secuencia + 1
  returning secuencia into v_seq;
  return v_seq;
end $$;

create function crear_orden_produccion(
  p_producto_id  uuid,
  p_cantidad     numeric,
  p_fecha_entrega date,
  p_proyecto_id  uuid,
  p_notas        text,
  p_usuario_id   uuid
) returns ordenes_produccion language plpgsql as $$
declare
  v_anio integer := extract(year from now())::int;
  v_seq integer;
  v_codigo text;
  v_orden ordenes_produccion;
begin
  if not exists (select 1 from boms where producto_id = p_producto_id) then
    raise exception 'BOM_NO_ENCONTRADO' using detail = json_build_object('productoId', p_producto_id)::text;
  end if;

  v_seq := siguiente_secuencia_anual('OP', v_anio);
  v_codigo := 'OP-' || v_anio || '-' || lpad(v_seq::text, 4, '0');

  insert into ordenes_produccion (codigo, producto_id, cantidad, estado, fecha_entrega, proyecto_id, notas, creado_por)
  values (v_codigo, p_producto_id, p_cantidad, 'BORRADOR', p_fecha_entrega, p_proyecto_id, coalesce(p_notas, ''), p_usuario_id)
  returning * into v_orden;

  return v_orden;
end $$;

create function crear_proyecto(
  p_nombre         text,
  p_descripcion    text,
  p_cliente        text,
  p_presupuesto    numeric,
  p_costo_estimado numeric,
  p_fecha_inicio   date,
  p_responsable_id uuid,
  p_usuario_id     uuid
) returns proyectos language plpgsql as $$
declare
  v_anio integer := extract(year from now())::int;
  v_seq integer;
  v_codigo text;
  v_proyecto proyectos;
begin
  v_seq := siguiente_secuencia_anual('PRY', v_anio);
  v_codigo := 'PRY-' || v_anio || '-' || lpad(v_seq::text, 4, '0');

  insert into proyectos (codigo, nombre, descripcion, cliente, presupuesto, costo_estimado, estado, fecha_inicio, responsable_id, creado_por, actualizado_por)
  values (v_codigo, p_nombre, coalesce(p_descripcion, ''), p_cliente, p_presupuesto, coalesce(p_costo_estimado, 0),
          'PLANIFICACION', p_fecha_inicio, p_responsable_id, p_usuario_id, p_usuario_id)
  returning * into v_proyecto;

  return v_proyecto;
end $$;

-- costo_real de proyectos, mantenido automáticamente por trigger — cierra la race condition
-- confirmada en app/api/gastos-proyecto/route.ts (POST leía proyectoSnap fuera de la
-- transacción y lo reusaba dentro de ella). Con este trigger la ruta deja de tener
-- aritmética manual: un INSERT/UPDATE/DELETE plano sobre gastos_proyecto basta.
create function gastos_proyecto_aplicar_delta() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update proyectos set costo_real = costo_real + new.monto, actualizado_en = now() where id = new.proyecto_id;
  elsif tg_op = 'UPDATE' then
    if new.proyecto_id <> old.proyecto_id then
      update proyectos set costo_real = greatest(0, costo_real - old.monto), actualizado_en = now() where id = old.proyecto_id;
      update proyectos set costo_real = costo_real + new.monto, actualizado_en = now() where id = new.proyecto_id;
    elsif new.monto <> old.monto then
      update proyectos set costo_real = greatest(0, costo_real + (new.monto - old.monto)), actualizado_en = now() where id = new.proyecto_id;
    end if;
  elsif tg_op = 'DELETE' then
    update proyectos set costo_real = greatest(0, costo_real - old.monto), actualizado_en = now() where id = old.proyecto_id;
  end if;
  return null;
end $$;

create trigger trg_gastos_proyecto_costo_real
after insert or update or delete on gastos_proyecto
for each row execute function gastos_proyecto_aplicar_delta();
