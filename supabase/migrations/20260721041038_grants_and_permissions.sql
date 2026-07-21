-- Grants explícitos. Descubierto durante la verificación manual de la Fase 1:
--
-- 1. Bajo el default actual del CLI de Supabase (auto_expose_new_tables sin activar),
--    las tablas creadas por el rol `postgres` (nuestras migraciones) NO reciben
--    automáticamente SELECT/INSERT/UPDATE/DELETE para `anon`/`authenticated`/`service_role`
--    — sólo TRUNCATE/REFERENCES/TRIGGER (privilegios PUBLIC por defecto de Postgres, no
--    sirven de nada aquí). Sin el GRANT explícito de tabla, las policies de RLS de la
--    migración anterior no tienen ningún efecto vía PostgREST (RLS sólo restringe filas
--    sobre un GRANT base ya existente, no lo sustituye) — y ni siquiera `service_role`
--    podía leer/escribir nada (confirmado con `set role service_role; select from stock`
--    → "permission denied for table stock").
-- 2. Postgres SÍ otorga EXECUTE a PUBLIC automáticamente al crear una función (a diferencia
--    de las tablas) — así que `anon`/`authenticated` tenían EXECUTE sobre las 7 funciones
--    de mutación por defecto. Ninguna de esas funciones valida el rol internamente (confían
--    en que la ruta API ya validó `canWrite`), así que dejarlas invocables directamente vía
--    PostgREST `/rpc/*` habría sido un bypass real de la capa de autorización de la app.

-- RLS también en contadores_anuales (tabla interna) — sin ninguna policy, lo que la deja
-- inaccesible a anon/authenticated incluso si en el futuro se le da GRANT SELECT por error.
alter table contadores_anuales enable row level security;

-- Habilitar el uso del schema para los roles de la Data API.
grant usage on schema public to authenticated, service_role;

-- service_role: acceso completo a todas las tablas (además de BYPASSRLS ya presente en el rol),
-- incluyendo las que se creen en migraciones futuras.
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to service_role;

-- authenticated: sólo SELECT, y sólo en las tablas con policy de lectura — el filtrado fino
-- por fila/rol ya lo hacen las policies de la migración anterior. `contadores_anuales` y
-- cualquier tabla nueva quedan fuera por defecto (no se agrega a `alter default privileges`
-- para authenticated: cada tabla nueva debe recibir su GRANT explícito junto con su policy).
grant select on
  unidades_medida, categorias, materiales, stock, movimientos_inventario,
  proveedores, proveedores_contactos, tabla_equivalencias, productos,
  boms, bom_lineas, bom_operaciones, proyectos, ordenes_produccion,
  orden_materiales_reservados, gastos_proyecto, perfiles,
  facturas_compra, factura_compra_lineas, factura_compra_retenciones,
  facturas_venta, factura_venta_lineas
to authenticated;

-- Las funciones de mutación de stock/contadores sólo deben ser invocables por service_role,
-- nunca directamente por un cliente autenticado vía PostgREST /rpc/*, aunque la app nunca las
-- llame desde el cliente hoy — es defensa en profundidad, no confiar sólo en que la ruta API
-- sea el único llamador.
revoke execute on function reservar_materiales_bom(uuid, uuid, numeric, uuid) from public;
revoke execute on function liberar_materiales_bom(uuid, uuid) from public;
revoke execute on function consumir_materiales_bom(uuid, uuid) from public;
revoke execute on function registrar_movimiento_inventario(uuid, tipo_movimiento, numeric, numeric, tipo_documento, uuid, text, text, uuid) from public;
revoke execute on function crear_orden_produccion(uuid, numeric, date, uuid, text, uuid) from public;
revoke execute on function crear_proyecto(text, text, text, numeric, numeric, date, uuid, uuid) from public;
revoke execute on function siguiente_secuencia_anual(text, integer) from public;

grant execute on function reservar_materiales_bom(uuid, uuid, numeric, uuid) to service_role;
grant execute on function liberar_materiales_bom(uuid, uuid) to service_role;
grant execute on function consumir_materiales_bom(uuid, uuid) to service_role;
grant execute on function registrar_movimiento_inventario(uuid, tipo_movimiento, numeric, numeric, tipo_documento, uuid, text, text, uuid) to service_role;
grant execute on function crear_orden_produccion(uuid, numeric, date, uuid, text, uuid) to service_role;
grant execute on function crear_proyecto(text, text, text, numeric, numeric, date, uuid, uuid) to service_role;
grant execute on function siguiente_secuencia_anual(text, integer) to service_role;
