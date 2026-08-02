-- Certificado de firma electrónica subido desde el ERP (reemplaza a las env vars
-- SRI_FIRMA_P12_BASE64/SRI_FIRMA_P12_PASSWORD). El archivo .p12 vive en un bucket
-- privado de Storage; la contraseña se cifra en la aplicación (AES-256-GCM, ver
-- lib/services/certificado.service.ts) antes de guardarse — nunca en texto plano.

insert into storage.buckets (id, name, public, file_size_limit)
values ('certificados-firma', 'certificados-firma', false, 1048576) -- 1MB, un .p12 pesa pocos KB
on conflict (id) do nothing;

-- Sin policies de storage.objects para anon/authenticated: solo service_role
-- (BYPASSRLS) puede leer/escribir, igual criterio que el resto de las tablas.

create table certificados_firma (
  id                uuid primary key default gen_random_uuid(),
  storage_path      text not null,
  password_cifrada  text not null,
  vigencia_hasta    date,
  activo            boolean not null default true,
  subido_en         timestamptz not null default now(),
  subido_por        uuid not null references auth.users(id)
);
create index certificados_firma_activo_idx on certificados_firma(activo);

alter table certificados_firma enable row level security;

-- Igual criterio que facturas_compra/facturas_venta: lectura restringida por rol
-- vía el claim del JWT, no abierta a todo `authenticated` (acá directamente solo
-- GERENTE, ni CONTABILIDAD).
create policy certificados_firma_select on certificados_firma for select
  using ((auth.jwt() -> 'app_metadata' ->> 'rol') = 'GERENTE');

grant select on certificados_firma to authenticated;
grant select, insert, update, delete on certificados_firma to service_role;
