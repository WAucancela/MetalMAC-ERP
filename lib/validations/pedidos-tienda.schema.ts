import { z } from 'zod';

export const PedidosTiendaQuerySchema = z.object({
  estado: z.enum(['PENDIENTE_CONTACTO', 'CONTACTADO', 'PAGADO', 'ENTREGADO', 'CANCELADO']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  startAfter: z.string().optional(),
});
export type PedidosTiendaQuery = z.infer<typeof PedidosTiendaQuerySchema>;

export const ActualizarEstadoPedidoTiendaSchema = z.object({
  estado: z.enum(['CONTACTADO', 'PAGADO', 'ENTREGADO', 'CANCELADO']),
  notas: z.string().max(500).optional(),
});
export type ActualizarEstadoPedidoTiendaInput = z.infer<typeof ActualizarEstadoPedidoTiendaSchema>;
