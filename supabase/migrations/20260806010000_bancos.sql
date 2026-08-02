-- Cuentas bancarias + movimientos. El saldo de una cuenta se calcula al leer
-- (saldo_inicial + depósitos/cobros - retiros/pagos), no se denormaliza con
-- trigger: a esta escala no vale la pena la complejidad extra, y evita
-- cualquier desincronización.

create type tipo_movimiento_bancario as enum (
  'DEPOSITO','RETIRO','PAGO_PROVEEDOR','COBRO_CLIENTE','AJUSTE'
);

create table cuentas_bancarias (
  id            uuid primary key default gen_random_uuid(),
  banco         text not null,
  numero_cuenta text not null,
  tipo_cuenta   text not null check (tipo_cuenta in ('AHORROS','CORRIENTE')),
  saldo_inicial numeric(14,4) not null default 0,
  activo        boolean not null default true,
  creado_en     timestamptz not null default now()
);

create table movimientos_bancarios (
  id                 uuid primary key default gen_random_uuid(),
  cuenta_bancaria_id uuid not null references cuentas_bancarias(id),
  tipo               tipo_movimiento_bancario not null,
  monto              numeric(14,4) not null check (monto > 0),
  fecha              date not null,
  descripcion        text not null default '',
  conciliado         boolean not null default false,
  creado_en          timestamptz not null default now(),
  creado_por         uuid not null references auth.users(id)
);
create index movimientos_bancarios_cuenta_fecha_idx on movimientos_bancarios(cuenta_bancaria_id, fecha desc);

alter table cuentas_bancarias    enable row level security;
alter table movimientos_bancarios enable row level security;

create policy cuentas_bancarias_select    on cuentas_bancarias    for select using (auth.role() = 'authenticated');
create policy movimientos_bancarios_select on movimientos_bancarios for select using (auth.role() = 'authenticated');

grant select on cuentas_bancarias, movimientos_bancarios to authenticated;
grant select, insert, update, delete on cuentas_bancarias, movimientos_bancarios to service_role;
