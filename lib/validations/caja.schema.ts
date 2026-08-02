import { z } from 'zod';

export const CajaMovimientoSchema = z.object({
  tipo: z.enum(['INGRESO', 'EGRESO']),
  monto: z.number().positive('El monto debe ser mayor a 0'),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato ISO: YYYY-MM-DD'),
  concepto: z.string().min(2).max(500),
  centroCostoId: z.string().uuid().nullable().optional(),
});
export type CajaMovimientoInput = z.infer<typeof CajaMovimientoSchema>;

export const CajaMovimientosQuerySchema = z.object({
  desde: z.string().optional(),
  hasta: z.string().optional(),
});
export type CajaMovimientosQuery = z.infer<typeof CajaMovimientosQuerySchema>;
