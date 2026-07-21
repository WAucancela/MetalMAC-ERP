import { z } from 'zod';

// ─────────────────────────────────────────────
// Proyecto
// ─────────────────────────────────────────────

export const ProyectoSchema = z.object({
  nombre:      z.string().min(2).max(200),
  descripcion: z.string().max(1000).default(''),
  cliente:     z.string().min(1).max(200),
  presupuesto: z.number().positive('El presupuesto debe ser mayor a 0'),
  estado:      z.enum(['PLANIFICACION', 'ACTIVO', 'PAUSADO', 'COMPLETADO', 'CANCELADO']).default('PLANIFICACION'),
  fechaInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato ISO: YYYY-MM-DD'),
  fechaFin:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  ordenesProduccion: z.array(z.string()).default([]),
});

export type ProyectoInput = z.infer<typeof ProyectoSchema>;

export const ActualizarProyectoSchema = ProyectoSchema.partial();
export type ActualizarProyectoInput = z.infer<typeof ActualizarProyectoSchema>;

export const ProyectosQuerySchema = z.object({
  estado:   z.enum(['PLANIFICACION', 'ACTIVO', 'PAUSADO', 'COMPLETADO', 'CANCELADO']).optional(),
  cliente:  z.string().optional(),
  limit:    z.coerce.number().int().min(1).max(100).default(50),
  startAfter: z.string().optional(),
});

export type ProyectosQuery = z.infer<typeof ProyectosQuerySchema>;

// ─────────────────────────────────────────────
// Gasto de Proyecto
// ─────────────────────────────────────────────

const CATEGORIAS_GASTO = [
  'MATERIALES', 'MANO_DE_OBRA', 'MAQUINARIA',
  'TRANSPORTE', 'SUBCONTRATO', 'ADMINISTRATIVO', 'OTRO',
] as const;

export const GastoSchema = z.object({
  proyectoId:  z.string().min(1),
  categoria:   z.enum(CATEGORIAS_GASTO),
  descripcion: z.string().min(2).max(500),
  monto:       z.number().positive('El monto debe ser mayor a 0'),
  fecha:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato ISO: YYYY-MM-DD'),
  proveedorId: z.string().nullable().optional(),
  facturaId:   z.string().nullable().optional(),
  ordenId:     z.string().nullable().optional(),
  comprobante: z.string().url().nullable().optional(),
});

export type GastoInput = z.infer<typeof GastoSchema>;

export const ActualizarGastoSchema = GastoSchema.omit({ proyectoId: true }).partial();
export type ActualizarGastoInput = z.infer<typeof ActualizarGastoSchema>;

export const GastosQuerySchema = z.object({
  proyectoId: z.string().optional(),
  categoria:  z.enum(CATEGORIAS_GASTO).optional(),
  desde:      z.string().optional(),
  hasta:      z.string().optional(),
  limit:      z.coerce.number().int().min(1).max(200).default(100),
  startAfter: z.string().optional(),
});

export type GastosQuery = z.infer<typeof GastosQuerySchema>;
