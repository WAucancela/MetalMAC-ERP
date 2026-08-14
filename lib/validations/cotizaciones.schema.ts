import { z } from 'zod';

// ─────────────────────────────────────────────
// Cotización
// ─────────────────────────────────────────────

const LineaCotizacionSchema = z.object({
  descripcion: z.string().min(1).max(500),
  cantidad: z.number().positive(),
  precioUnitario: z.number().nonnegative(),
  productoId: z.string().uuid().nullable().default(null),
  materialId: z.string().uuid().nullable().default(null),
});

export const CotizacionSchema = z.object({
  clienteNombre: z.string().min(2).max(300),
  clienteEmail: z.string().email().or(z.literal('')).default(''),
  clienteWhatsapp: z.string().max(20).default(''),
  proyectoId: z.string().uuid().nullable().default(null),
  fechaEmision: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato ISO: YYYY-MM-DD'),
  fechaVencimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato ISO: YYYY-MM-DD'),
  notas: z.string().max(1000).default(''),
  lineas: z.array(LineaCotizacionSchema).min(1, 'Agregá al menos una línea'),
});

export type CotizacionInput = z.infer<typeof CotizacionSchema>;

export const ActualizarCotizacionSchema = CotizacionSchema.partial();
export type ActualizarCotizacionInput = z.infer<typeof ActualizarCotizacionSchema>;

export const CambiarEstadoCotizacionSchema = z.object({
  estado: z.enum(['APROBADA', 'RECHAZADA']),
});
export type CambiarEstadoCotizacionInput = z.infer<typeof CambiarEstadoCotizacionSchema>;

export const ConvertirCotizacionSchema = z.object({
  nombre: z.string().min(2).max(200),
  fechaInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato ISO: YYYY-MM-DD'),
  presupuesto: z.number().positive('El presupuesto debe ser mayor a 0'),
});
export type ConvertirCotizacionInput = z.infer<typeof ConvertirCotizacionSchema>;

export const CotizacionesQuerySchema = z.object({
  estado: z.enum(['BORRADOR', 'ENVIADA', 'APROBADA', 'RECHAZADA', 'VENCIDA']).optional(),
  proyectoId: z.string().optional(),
  desde: z.string().optional(),
  hasta: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  startAfter: z.string().optional(),
});
export type CotizacionesQuery = z.infer<typeof CotizacionesQuerySchema>;
