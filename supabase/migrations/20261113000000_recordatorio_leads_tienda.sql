-- Marca de cuándo se mandó el recordatorio interno de "lead sin atender" (cron
-- seguimiento-solicitudes-tienda) — igual patrón que ultimo_seguimiento_en en
-- cotizaciones, pero un único aviso (no reintentos escalonados).
alter table solicitudes_contacto add column recordatorio_enviado_en timestamptz;
alter table pedidos_tienda       add column recordatorio_enviado_en timestamptz;
