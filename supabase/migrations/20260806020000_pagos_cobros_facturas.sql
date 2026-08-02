-- Fecha de vencimiento + pagos/cobros parciales sobre facturas de compra/venta.
-- El saldo pendiente de una factura se calcula al leer (total - suma de
-- pagos/cobros), no se denormaliza — mismo criterio que el saldo de cuentas
-- bancarias en la migración anterior.

alter table facturas_compra add column fecha_vencimiento date;
alter table facturas_venta  add column fecha_vencimiento date;

create table pagos_factura_compra (
  id                 uuid primary key default gen_random_uuid(),
  factura_compra_id  uuid not null references facturas_compra(id) on delete cascade,
  monto              numeric(14,4) not null check (monto > 0),
  fecha              date not null,
  metodo_pago        text not null default '',
  referencia         text not null default '',
  cuenta_bancaria_id uuid references cuentas_bancarias(id),
  notas              text not null default '',
  creado_en          timestamptz not null default now(),
  creado_por         uuid not null references auth.users(id)
);
create index pagos_factura_compra_factura_idx on pagos_factura_compra(factura_compra_id, fecha desc);

create table cobros_factura_venta (
  id                 uuid primary key default gen_random_uuid(),
  factura_venta_id   uuid not null references facturas_venta(id) on delete cascade,
  monto              numeric(14,4) not null check (monto > 0),
  fecha              date not null,
  metodo_pago        text not null default '',
  referencia         text not null default '',
  cuenta_bancaria_id uuid references cuentas_bancarias(id),
  notas              text not null default '',
  creado_en          timestamptz not null default now(),
  creado_por         uuid not null references auth.users(id)
);
create index cobros_factura_venta_factura_idx on cobros_factura_venta(factura_venta_id, fecha desc);

alter table pagos_factura_compra enable row level security;
alter table cobros_factura_venta enable row level security;

create policy pagos_factura_compra_select on pagos_factura_compra for select using (auth.role() = 'authenticated');
create policy cobros_factura_venta_select on cobros_factura_venta for select using (auth.role() = 'authenticated');

grant select on pagos_factura_compra, cobros_factura_venta to authenticated;
grant select, insert, update, delete on pagos_factura_compra, cobros_factura_venta to service_role;
