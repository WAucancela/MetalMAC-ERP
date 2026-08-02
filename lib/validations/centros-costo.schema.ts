import { z } from 'zod';

export const CentroCostoSchema = z.object({
  codigo: z.string().min(1).max(20),
  nombre: z.string().min(2).max(200),
  activo: z.boolean().default(true),
});

export type CentroCostoInput = z.infer<typeof CentroCostoSchema>;

export const ActualizarCentroCostoSchema = CentroCostoSchema.partial();
export type ActualizarCentroCostoInput = z.infer<typeof ActualizarCentroCostoSchema>;

export const CentrosCostoQuerySchema = z.object({
  activo: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
});
export type CentrosCostoQuery = z.infer<typeof CentrosCostoQuerySchema>;
