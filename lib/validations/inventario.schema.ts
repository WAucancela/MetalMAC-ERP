/**
 * inventario.schema.ts
 * Schemas Zod para todas las API Routes de inventario.
 * Importar en /app/api/ routes para validar el request body antes de procesar.
 */
import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Enums (mirroring metalmac.types.ts — Zod los valida en runtime)
// ─────────────────────────────────────────────────────────────────────────────

export const TipoMaterialSchema = z.enum([
  'PLANCHA', 'TUBO', 'PERFIL', 'VARILLA', 'CONSUMIBLE',
]);

export const TipoMovimientoSchema = z.enum([
  'ENTRADA', 'SALIDA', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO',
  'RESERVA', 'LIBERACION', 'MERMA', 'DEVOLUCION',
]);

export const TipoDocumentoSchema = z.enum([
  'FACTURA_COMPRA', 'ORDEN_PRODUCCION', 'AJUSTE_MANUAL',
]);

// ─────────────────────────────────────────────────────────────────────────────
// Materiales
// ─────────────────────────────────────────────────────────────────────────────

export const EspecificacionesPlanchaSchema = z.object({
  anchoMm:    z.number().positive(),
  largoMm:    z.number().positive(),
  espesorMm:  z.number().positive(),
  pesoKgM2:   z.number().positive(),
  acabado:    z.string().optional(),
});

export const EspecificacionesTuboPerfilSchema = z.object({
  longitudNominalMm: z.number().positive(),
  pesoKgM:           z.number().positive(),
});

export const EspecificacionesConsumibleSchema = z.object({
  rendimientoUnitario: z.number().positive(),
});

export const CreateMaterialSchema = z.object({
  codigoInterno:    z.string().min(3).max(60),
  nombre:           z.string().min(2).max(120),
  descripcion:      z.string().max(500).default(''),
  tipo:             TipoMaterialSchema,
  categoriaId:      z.string().min(1),
  grado:            z.string().max(30).default(''),
  unidadBaseId:     z.string().min(1),
  costoUnitario:    z.number().nonnegative(),
  especificaciones: z
    .union([
      EspecificacionesPlanchaSchema,
      EspecificacionesTuboPerfilSchema,
      EspecificacionesConsumibleSchema,
      z.record(z.never()),
    ])
    .default({}),
  activo: z.boolean().default(true),
});

export const UpdateMaterialSchema = CreateMaterialSchema.partial();

export type CreateMaterialInput = z.infer<typeof CreateMaterialSchema>;
export type UpdateMaterialInput = z.infer<typeof UpdateMaterialSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Movimientos de inventario
// ─────────────────────────────────────────────────────────────────────────────

export const CreateMovimientoSchema = z.object({
  materialId:       z.string().min(1),
  tipo:             TipoMovimientoSchema,
  cantidad:         z.number().positive('La cantidad debe ser mayor a 0'),
  costoUnitario:    z.number().nonnegative(),
  documentoTipo:    TipoDocumentoSchema,
  documentoId:      z.string().optional(),
  numeroReferencia: z.string().min(1).max(80),
  notas:            z.string().max(500).optional(),
  // usuarioId lo inyecta el servidor desde el token — no viene del cliente
});

export type CreateMovimientoInput = z.infer<typeof CreateMovimientoSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Stock
// ─────────────────────────────────────────────────────────────────────────────

export const UpdateStockMinimasSchema = z.object({
  cantidadMinima: z.number().nonnegative(),
  cantidadMaxima: z.number().positive().nullable().optional(),
  ubicacion:      z.string().max(100).optional(),
});

export type UpdateStockMinimasInput = z.infer<typeof UpdateStockMinimasSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Query params comunes
// ─────────────────────────────────────────────────────────────────────────────

export const PaginationSchema = z.object({
  limite:  z.coerce.number().int().min(1).max(100).default(50),
  cursor:  z.string().optional(),
});

export const MaterialesQuerySchema = PaginationSchema.extend({
  tipo:   TipoMaterialSchema.optional(),
  activo: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  q:      z.string().max(80).optional(), // búsqueda por nombre/código
});

export const MovimientosQuerySchema = PaginationSchema.extend({
  materialId: z.string().optional(),
  tipo:       TipoMovimientoSchema.optional(),
  desde:      z.coerce.date().optional(),
  hasta:      z.coerce.date().optional(),
});
