-- Configuración SRI/Resend editable desde el ERP (reemplaza al resto de las env
-- vars de Fase 2: SRI_AMBIENTE, SRI_EMISOR_*, RESEND_API_KEY, RESEND_FROM_EMAIL).
-- Tabla singleton (una sola fila, id fijo en 1). resend_api_key_cifrada nunca se
-- guarda en texto plano — se cifra en la aplicación (ver
-- lib/services/cifrado.service.ts) antes de guardarse, igual criterio que la
-- contraseña del certificado de firma.

create table configuracion_sri (
  id                            integer primary key default 1,
  ambiente                      text check (ambiente in ('PRUEBAS','PRODUCCION')),
  emisor_ruc                    text,
  emisor_razon_social           text,
  emisor_nombre_comercial       text,
  emisor_dir_matriz             text,
  emisor_dir_establecimiento    text,
  emisor_obligado_contabilidad  text check (emisor_obligado_contabilidad in ('SI','NO')),
  resend_from_email             text,
  resend_api_key_cifrada        text,
  actualizado_en                timestamptz not null default now(),
  actualizado_por               uuid references auth.users(id),
  constraint configuracion_sri_singleton check (id = 1)
);

alter table configuracion_sri enable row level security;

-- Igual criterio que certificados_firma: solo GERENTE puede leer, ni siquiera
-- CONTABILIDAD (acá vive la API key cifrada de Resend además de los datos SRI).
create policy configuracion_sri_select on configuracion_sri for select
  using ((auth.jwt() -> 'app_metadata' ->> 'rol') = 'GERENTE');

grant select on configuracion_sri to authenticated;
grant select, insert, update, delete on configuracion_sri to service_role;
