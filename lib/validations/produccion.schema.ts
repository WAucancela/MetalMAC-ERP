import { z } from 'zod';

// ─────────────────────────────────────────────
// Producto
// ─────────────────────────────────────────────

export const ProductoSchema = z.object({
  codigo: z.string().min(1).max(50),
  nombre: z.string().min(2).max(200),
  descripcion: z.string().max(500).default(''),
  tipo: z.enum(['PRODUCTO_TERMINADO', 'SEMIELABORADO']),
  unidadVenta: z.string().min(1),         // "UNIDAD", "m²", etc.
  precioVenta: z.number().nonnegative(),
  activo: z.boolean().default(true),
});

export type ProductoInput = z.infer<typeof ProductoSchema>;

// ─────────────────────────────────────────────
// BOM — Líneas de materiales y operaciones
// ─────────────────────────────────────────────

export const LineaBOMSchema = z.object({
  materialId: z.string().min(1),
  cantidadBase: z.number().positive('La cantidad debe ser mayor a 0'),
  factorMerma: z
    .number()
    .min(1, 'El factor de merma debe ser ≥ 1 (1 = sin merma)')
    .max(3, 'Factor de merma no puede superar 3'),
  unidadId: z.string().min(1),
  notas: z.string().max(200).default(''),
});

export type LineaBOMInput = z.infer<typeof LineaBOMSchema>;

export const OperacionBOMSchema = z.object({
  tipoOperacionId: z.string().min(1),
  minutos: z.number().positive(),
  costoPorMinuto: z.number().nonnegative(),
});

export type OperacionBOMInput = z.infer<typeof OperacionBOMSchema>;

export const BOMSchema = z.object({
  lineas: z.array(LineaBOMSchema).min(1, 'El BOM debe tener al menos un material'),
  operaciones: z.array(OperacionBOMSchema).default([]),
});

export type BOMInput = z.infer<typeof BOMSchema>;

// ─────────────────────────────────────────────
// Orden de Producción
// ─────────────────────────────────────────────

export const CrearOrdenSchema = z.object({
  productoId: z.string().min(1),
  cantidad: z.number().int().positive(),
  fechaEntrega: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato ISO: YYYY-MM-DD'),
  proyectoId: z.string().optional(),
  notas: z.string().max(500).default(''),
});

export type CrearOrdenInput = z.infer<typeof CrearOrdenSchema>;

export const ActualizarEstadoOrdenSchema = z.object({
  estado: z.enum(['EN_PROCESO', 'COMPLETADA', 'CANCELADA']),
  notas: z.string().max(500).optional(),
});

export type ActualizarEstadoOrdenInput = z.infer<typeof ActualizarEstadoOrdenSchema>;

// ─────────────────────────────────────────────
// Planificación de planta — Operarios y Operaciones de OP
// ─────────────────────────────────────────────

export const OperarioSchema = z.object({
  nombre: z.string().min(2).max(200),
  activo: z.boolean().default(true),
});

export type OperarioInput = z.infer<typeof OperarioSchema>;

export const ActualizarOperarioSchema = OperarioSchema.partial();

export type ActualizarOperarioInput = z.infer<typeof ActualizarOperarioSchema>;

export const TipoOperacionSchema = z.object({
  nombre: z.string().min(2).max(100),
  activo: z.boolean().default(true),
});

export type TipoOperacionInput = z.infer<typeof TipoOperacionSchema>;

export const ActualizarTipoOperacionSchema = TipoOperacionSchema.partial();

export type ActualizarTipoOperacionInput = z.infer<typeof ActualizarTipoOperacionSchema>;

export const AsignarOperacionSchema = z.object({
  operarioId: z.string().uuid().nullable(),
});

export type AsignarOperacionInput = z.infer<typeof AsignarOperacionSchema>;

export const CompletarOperacionSchema = z.object({
  estado: z.literal('COMPLETADA'),
  minutosReales: z.number().nonnegative(),
});

export type CompletarOperacionInput = z.infer<typeof CompletarOperacionSchema>;

export const ActualizarOperacionSchema = z.union([AsignarOperacionSchema, CompletarOperacionSchema]);

export type ActualizarOperacionInput = z.infer<typeof ActualizarOperacionSchema>;

// ─────────────────────────────────────────────
// Query filters
// ─────────────────────────────────────────────

export const OrdenesQuerySchema = z.object({
  estado: z.enum(['BORRADOR', 'EN_PROCESO', 'COMPLETADA', 'CANCELADA']).optional(),
  productoId: z.string().optional(),
  proyectoId: z.string().optional(),
  desde: z.string().optional(),
  hasta: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  startAfter: z.string().optional(),
});

export type OrdenesQuery = z.infer<typeof OrdenesQuerySchema>;

export const ProductosQuerySchema = z.object({
  tipo: z.enum(['PRODUCTO_TERMINADO', 'SEMIELABORADO']).optional(),
  activo: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type ProductosQuery = z.infer<typeof ProductosQuerySchema>;

export const OperariosQuerySchema = z.object({
  activo: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
});

export type OperariosQuery = z.infer<typeof OperariosQuerySchema>;

export const TiposOperacionQuerySchema = z.object({
  activo: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
});

export type TiposOperacionQuery = z.infer<typeof TiposOperacionQuerySchema>;
