-- Caja chica: una sola caja implícita (el taller es una sola ubicación). Si en
-- el futuro hace falta más de una, se agrega un catálogo `cajas` y `caja_id`
-- acá, pero no ahora. Saldo = suma(INGRESO) - suma(EGRESO), calculado al leer.

create type tipo_movimiento_caja as enum ('INGRESO','EGRESO');

create table caja_chica_movimientos (
  id              uuid primary key default gen_random_uuid(),
  tipo            tipo_movimiento_caja not null,
  monto           numeric(14,4) not null check (monto > 0),
  fecha           date not null,
  concepto        text not null,
  centro_costo_id uuid references centros_costo(id),
  creado_en       timestamptz not null default now(),
  creado_por      uuid not null references auth.users(id)
);
create index caja_chica_movimientos_fecha_idx on caja_chica_movimientos(fecha desc);

alter table caja_chica_movimientos enable row level security;
create policy caja_chica_movimientos_select on caja_chica_movimientos for select using (auth.role() = 'authenticated');
grant select on caja_chica_movimientos to authenticated;
grant select, insert, update, delete on caja_chica_movimientos to service_role;
