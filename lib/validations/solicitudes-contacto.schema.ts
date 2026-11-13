import { z } from 'zod';

export const SolicitudesContactoQuerySchema = z.object({
  estado: z.enum(['NUEVA', 'CONTACTADA', 'DESCARTADA']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  startAfter: z.string().optional(),
});
export type SolicitudesContactoQuery = z.infer<typeof SolicitudesContactoQuerySchema>;

export const ActualizarEstadoSolicitudSchema = z.object({
  estado: z.enum(['CONTACTADA', 'DESCARTADA']),
});
export type ActualizarEstadoSolicitudInput = z.infer<typeof ActualizarEstadoSolicitudSchema>;
