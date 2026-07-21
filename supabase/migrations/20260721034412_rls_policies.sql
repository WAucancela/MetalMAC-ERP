-- RLS: sólo políticas de SELECT (por rol o `authenticated`). Ninguna política de
-- INSERT/UPDATE/DELETE — Postgres deniega por defecto si no hay política que aplique,
-- así que ninguna escritura de cliente (anon/authenticated) es posible. Toda mutación
-- pasa por las API routes con una conexión service_role (BYPASSRLS, nunca se envía al
-- navegador — igual que firebase-admin hoy).

alter table unidades_medida            enable row level security;
alter table categorias                 enable row level security;
alter table materiales                 enable row level security;
alter table stock                      enable row level security;
alter table movimientos_inventario     enable row level security;
alter table proveedores                enable row level security;
alter table proveedores_contactos      enable row level security;
alter table tabla_equivalencias        enable row level security;
alter table productos                  enable row level security;
alter table boms                       enable row level security;
alter table bom_lineas                 enable row level security;
alter table bom_operaciones            enable row level security;
alter table proyectos                  enable row level security;
alter table facturas_compra            enable row level security;
alter table factura_compra_lineas      enable row level security;
alter table factura_compra_retenciones enable row level security;
alter table ordenes_produccion         enable row level security;
alter table orden_materiales_reservados enable row level security;
alter table gastos_proyecto            enable row level security;
alter table facturas_venta             enable row level security;
alter table factura_venta_lineas       enable row level security;
alter table perfiles                   enable row level security;

-- Lectura abierta a cualquier usuario autenticado (mirror de `isAuth()` en firestore.rules)
create policy unidades_medida_select        on unidades_medida            for select using (auth.role() = 'authenticated');
create policy categorias_select             on categorias                 for select using (auth.role() = 'authenticated');
create policy materiales_select             on materiales                 for select using (auth.role() = 'authenticated');
create policy stock_select                  on stock                      for select using (auth.role() = 'authenticated');
create policy movimientos_select            on movimientos_inventario     for select using (auth.role() = 'authenticated');
create policy proveedores_select            on proveedores                for select using (auth.role() = 'authenticated');
create policy proveedores_contactos_select  on proveedores_contactos      for select using (auth.role() = 'authenticated');
create policy tabla_equivalencias_select    on tabla_equivalencias        for select using (auth.role() = 'authenticated');
create policy productos_select              on productos                  for select using (auth.role() = 'authenticated');
create policy boms_select                   on boms                       for select using (auth.role() = 'authenticated');
create policy bom_lineas_select             on bom_lineas                 for select using (auth.role() = 'authenticated');
create policy bom_operaciones_select        on bom_operaciones            for select using (auth.role() = 'authenticated');
create policy proyectos_select              on proyectos                  for select using (auth.role() = 'authenticated');
create policy ordenes_produccion_select     on ordenes_produccion         for select using (auth.role() = 'authenticated');
create policy orden_materiales_reservados_select on orden_materiales_reservados for select using (auth.role() = 'authenticated');
create policy gastos_proyecto_select        on gastos_proyecto            for select using (auth.role() = 'authenticated');
create policy perfiles_select               on perfiles                   for select using (auth.role() = 'authenticated');

-- Lectura restringida a CONTABILIDAD/GERENTE (mirror de `isContabilidad()` en firestore.rules,
-- que restringía tanto lectura como escritura de facturas_compra/facturas_venta)
create policy facturas_compra_select on facturas_compra for select
  using ((auth.jwt() -> 'app_metadata' ->> 'rol') in ('CONTABILIDAD','GERENTE'));
create policy factura_compra_lineas_select on factura_compra_lineas for select
  using ((auth.jwt() -> 'app_metadata' ->> 'rol') in ('CONTABILIDAD','GERENTE'));
create policy factura_compra_retenciones_select on factura_compra_retenciones for select
  using ((auth.jwt() -> 'app_metadata' ->> 'rol') in ('CONTABILIDAD','GERENTE'));
create policy facturas_venta_select on facturas_venta for select
  using ((auth.jwt() -> 'app_metadata' ->> 'rol') in ('CONTABILIDAD','GERENTE'));
create policy factura_venta_lineas_select on factura_venta_lineas for select
  using ((auth.jwt() -> 'app_metadata' ->> 'rol') in ('CONTABILIDAD','GERENTE'));

-- Nota: los roles de escritura (isBodeguero()/isProduccion()/isContabilidad() en firestore.rules)
-- se aplican en la capa de ruta vía `canWrite`/helpers de rol (app/api/_helpers.ts), no como
-- policies SQL de INSERT/UPDATE/DELETE, porque nunca hubo ni habrá escritura directa desde cliente.
