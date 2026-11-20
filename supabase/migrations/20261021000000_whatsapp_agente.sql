-- Agente de ventas por WhatsApp (Meta Cloud API): el cliente final escribe su
-- pedido por WhatsApp, el agente lo cotiza contra el catálogo real (mismo
-- principio que cotizacion-ia.service.ts — nunca inventa producto ni precio) y
-- deja un BORRADOR en cotizaciones para que el staff revise/envíe.
--
-- cotizaciones.creado_por pasa a ser NULLABLE: una cotización creada por el bot
-- no tiene un usuario humano logueado detrás. `origen` distingue en reportes
-- cuáles vinieron del bot vs. las que cargó el staff a mano.
alter table cotizaciones alter column creado_por drop not null;
alter table cotizaciones add column origen text not null default 'STAFF'
  check (origen in ('STAFF', 'WHATSAPP_BOT'));

-- Una fila por número de WhatsApp — el historial de la conversación vive acá
-- porque cada request a la API route es stateless (serverless): sin esto, el
-- agente "olvidaría" la conversación entre un mensaje y el siguiente.
create table whatsapp_conversaciones (
  id                     uuid primary key default gen_random_uuid(),
  telefono               text not null unique,
  nombre_contacto        text not null default '',
  cliente_id             uuid references clientes(id),
  cotizacion_borrador_id uuid references cotizaciones(id),
  historial              jsonb not null default '[]'::jsonb,
  estado                 text not null default 'ACTIVA' check (estado in ('ACTIVA', 'CERRADA')),
  creado_en              timestamptz not null default now(),
  actualizado_en         timestamptz not null default now()
);
create index whatsapp_conversaciones_telefono_idx on whatsapp_conversaciones(telefono);

alter table whatsapp_conversaciones enable row level security;
create policy whatsapp_conversaciones_select on whatsapp_conversaciones for select using (auth.role() = 'authenticated');
grant select on whatsapp_conversaciones to authenticated;
grant select, insert, update, delete on whatsapp_conversaciones to service_role;
