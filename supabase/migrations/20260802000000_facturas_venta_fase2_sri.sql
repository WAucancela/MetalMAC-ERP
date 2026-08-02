-- Fase 2 de facturación de venta: campos para el trámite real ante el SRI
-- (recepción + autorización), además del estado de negocio que ya existía en
-- estado_factura_venta. sri_estado es más granular a propósito: "enviado pero
-- todavía sin autorizar" no encaja ni en BORRADOR ni en EMITIDA.

create type sri_estado_tramite as enum (
  'PENDIENTE_ENVIO', 'RECIBIDO', 'AUTORIZADO', 'RECHAZADO', 'DEVUELTO'
);

alter table facturas_venta
  add column xml_firmado_url  text,
  add column ride_url         text,
  add column sri_estado       sri_estado_tramite,
  add column sri_mensaje      text not null default '',
  add column email_enviado_en timestamptz;
