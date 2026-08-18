import { z } from 'zod';

// ─────────────────────────────────────────────
// Proveedor
// ─────────────────────────────────────────────

export const ProveedorSchema = z.object({
  ruc: z
    .string()
    .length(13, 'El RUC debe tener exactamente 13 dígitos')
    .regex(/^\d+$/, 'El RUC solo puede contener dígitos'),
  razonSocial: z.string().min(3).max(300),
  nombreComercial: z.string().min(1).max(200),
  tipoContribuyente: z.enum(['PERSONA_NATURAL', 'SOCIEDAD', 'RISE']),
  contribuyenteEspecial: z.boolean().default(false),
  obligaContabilidad: z.boolean().default(false),
  agenteRetencion: z.boolean().default(false),
  diasCredito: z.number().int().min(0).max(365).default(30),
  telefonoPrincipal: z.string().min(7).max(20),
  emailPrincipal: z.string().email(),
  ciudad: z.string().min(2).max(100),
  activo: z.boolean().default(true),
});

export type ProveedorInput = z.infer<typeof ProveedorSchema>;

// ─────────────────────────────────────────────
// Tabla de Equivalencias
// ─────────────────────────────────────────────

export const TablaEquivalenciaSchema = z.object({
  proveedorId: z.string().min(1),
  codigoProveedor: z.string().min(1).max(100),
  descripcionProveedor: z.string().min(1).max(500),
  materialId: z.string().min(1),
  unidadProveedorId: z.string().min(1),
  factorConversion: z.number().positive('El factor debe ser mayor a 0'),
  precioReferencia: z.number().nonnegative(),
  activo: z.boolean().default(true),
});

export type TablaEquivalenciaInput = z.infer<typeof TablaEquivalenciaSchema>;

/**
 * Mapea manualmente una línea "sin resolver" de una factura ya guardada a un
 * material del inventario. A diferencia de TablaEquivalenciaSchema (alta directa
 * de una equivalencia), acá proveedorId/codigoProveedor/descripcionProveedor/
 * precioReferencia se derivan en el server desde la línea y la factura — el
 * usuario solo elige material, unidad del proveedor y factor de conversión.
 */
export const MapearLineaFacturaSchema = z.object({
  materialId: z.string().min(1),
  unidadProveedorId: z.string().min(1),
  factorConversion: z.number().positive('El factor debe ser mayor a 0').default(1),
});

export type MapearLineaFacturaInput = z.infer<typeof MapearLineaFacturaSchema>;

// ─────────────────────────────────────────────
// Factura de Compra (creación manual / después de parsear XML)
// ─────────────────────────────────────────────

const LineaFacturaSchema = z.object({
  codigoProveedor: z.string(),
  descripcion: z.string(),
  cantidad: z.number().positive(),
  precioUnitario: z.number().nonnegative(),
  descuento: z.number().nonnegative().default(0),
  subtotal: z.number().nonnegative(),
  materialId: z.string().nullable().default(null),
  cantidadConvertida: z.number().nullable().default(null),
});

const RetencioSchema = z.object({
  tipo: z.enum(['RENTA', 'IVA']),
  porcentaje: z.number().positive(),
  base: z.number().nonnegative(),
  valor: z.number().nonnegative(),
});

export const FacturaCompraSchema = z.object({
  proveedorId: z.string().min(1),
  claveAcceso: z
    .string()
    .length(49, 'La clave de acceso SRI debe tener exactamente 49 dígitos')
    .regex(/^\d+$/, 'La clave de acceso solo puede contener dígitos'),
  numeroFactura: z
    .string()
    .regex(
      /^\d{3}-\d{3}-\d{9}$/,
      'Formato esperado: 001-001-000000001',
    ),
  fechaEmision: z.string().regex(
    /^\d{4}-\d{2}-\d{2}$/,
    'Formato ISO: YYYY-MM-DD',
  ),
  subtotalSinIva: z.number().nonnegative(),
  iva: z.number().nonnegative(),
  total: z.number().nonnegative(),
  xmlUrl: z.union([z.literal(''), z.string().url()]).default(''),
  estado: z.enum(['PENDIENTE', 'PROCESADA', 'ANULADA']).default('PENDIENTE'),
  lineas: z.array(LineaFacturaSchema).min(1),
  retenciones: z.array(RetencioSchema).default([]),
});

export type FacturaCompraInput = z.infer<typeof FacturaCompraSchema>;

// ─────────────────────────────────────────────
// API: Parse XML
// ─────────────────────────────────────────────

/**
 * No Zod body schema aquí — el endpoint recibe multipart/form-data (File).
 * La validación del XML la hace el servicio internamente.
 */

// ─────────────────────────────────────────────
// API: Resolver Equivalencias
// ─────────────────────────────────────────────

export const ResolverEquivalenciasSchema = z.object({
  proveedorId: z.string().min(1),
  lineas: z
    .array(
      z.object({
        codigoInterno: z.string(),
        codigoAdicional: z.string(),
        descripcion: z.string(),
        cantidad: z.number().positive(),
        precioUnitario: z.number().nonnegative(),
        descuento: z.number().nonnegative(),
        precioTotalSinImpuesto: z.number().nonnegative(),
      }),
    )
    .min(1),
});

export type ResolverEquivalenciasInput = z.infer<typeof ResolverEquivalenciasSchema>;

// ─────────────────────────────────────────────
// Query filters
// ─────────────────────────────────────────────

export const FacturasQuerySchema = z.object({
  proveedorId: z.string().optional(),
  estado: z.enum(['PENDIENTE', 'PROCESADA', 'ANULADA']).optional(),
  desde: z.string().optional(),   // ISO date
  hasta: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  startAfter: z.string().optional(),
});

export type FacturasQuery = z.infer<typeof FacturasQuerySchema>;

export const ProveedoresQuerySchema = z.object({
  activo: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  q: z.string().optional(),       // search term
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type ProveedoresQuery = z.infer<typeof ProveedoresQuerySchema>;
