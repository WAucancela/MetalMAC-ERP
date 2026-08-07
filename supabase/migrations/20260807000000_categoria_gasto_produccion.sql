-- Nueva categoría de gasto para el costo de producción generado automáticamente
-- al completar una OP vinculada a un proyecto (ver app/api/ordenes-produccion/[id]/route.ts).
-- Distingue ese costo, generado por el sistema, de los gastos cargados a mano.
alter type categoria_gasto add value 'PRODUCCION';
