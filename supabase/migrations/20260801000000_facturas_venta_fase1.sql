-- Fase 1 de facturación de venta: modelo de datos para registrar ventas en el ERP
-- ligadas a un Proyecto, sin emisión electrónica automática todavía (eso es Fase 2:
-- generar XML, firmar XAdES-BES con el .p12, enviar al SRI). Mientras tanto el staff
-- sigue emitiendo por el portal "Facturación en línea" del SRI y pega el número de
-- factura + clave de acceso resultantes de vuelta acá para dejar el registro completo.

-- clave_acceso todavía no existe al crear la factura en BORRADOR — solo se conoce
-- cuando el staff la marca como EMITIDA con lo que le devolvió el portal del SRI.
alter table facturas_venta alter column clave_acceso drop not null;

alter table facturas_venta
  add column proyecto_id    uuid references proyectos(id),
  add column cliente_email  text not null default '',
  add column establecimiento text not null default '001',
  add column punto_emision   text not null default '001',
  -- Se deja sin asignar en esta fase a propósito: el secuencial real del SRI no puede
  -- tener huecos, así que solo se asigna en Fase 2 en el momento real de emisión —
  -- nunca antes, para no "quemar" números en borradores que se cancelan.
  add column secuencial      integer,
  add column creado_por      uuid references auth.users(id);

create index facturas_venta_proyecto_idx      on facturas_venta(proyecto_id);
create index facturas_venta_estado_fecha_idx  on facturas_venta(estado, fecha_emision desc);
create index factura_venta_lineas_factura_idx on factura_venta_lineas(factura_id, orden);
