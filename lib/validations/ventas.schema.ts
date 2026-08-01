import { z } from 'zod';
import { validarClaveAcceso, ClaveAccesoInvalidaError } from '@/lib/services/sri.service';

// ─────────────────────────────────────────────
// Factura de Venta — Fase 1 (registro manual, sin emisión electrónica todavía)
// ─────────────────────────────────────────────

const LineaFacturaVentaSchema = z.object({
  descripcion: z.string().min(1).max(500),
  cantidad: z.number().positive(),
  precioUnitario: z.number().nonnegative(),
  ordenProduccionId: z.string().nullable().default(null),
});

export const FacturaVentaSchema = z.object({
  proyectoId: z.string().nullable().default(null),
  clienteNombre: z.string().min(2).max(300),
  clienteRuc: z
    .string()
    .regex(/^\d{10}$|^\d{13}$/, 'Debe ser cédula (10 dígitos) o RUC (13 dígitos)'),
  clienteEmail: z.string().email(),
  fechaEmision: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato ISO: YYYY-MM-DD'),
  lineas: z.array(LineaFacturaVentaSchema).min(1),
});

export type FacturaVentaInput = z.infer<typeof FacturaVentaSchema>;

/**
 * Al pegar el número de factura y la clave de acceso que devolvió el portal del SRI,
 * la clave se valida con el mismo módulo 11 que ya usamos para facturas de compra
 * (validarClaveAcceso, lib/services/sri.service.ts) — misma estructura de 49 dígitos
 * sin importar si el comprobante es de compra o de venta.
 */
export const MarcarEmitidaSchema = z.object({
  numeroFactura: z
    .string()
    .regex(/^\d{3}-\d{3}-\d{9}$/, 'Formato esperado: 001-001-000000001'),
  claveAcceso: z
    .string()
    .length(49, 'La clave de acceso SRI debe tener exactamente 49 dígitos')
    .regex(/^\d+$/, 'La clave de acceso solo puede contener dígitos')
    .superRefine((clave, ctx) => {
      try {
        validarClaveAcceso(clave);
      } catch (e) {
        if (e instanceof ClaveAccesoInvalidaError) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: e.motivo });
        } else {
          throw e;
        }
      }
    }),
});

export type MarcarEmitidaInput = z.infer<typeof MarcarEmitidaSchema>;

export const FacturasVentaQuerySchema = z.object({
  proyectoId: z.string().optional(),
  estado: z.enum(['BORRADOR', 'EMITIDA', 'ANULADA']).optional(),
  desde: z.string().optional(),
  hasta: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  startAfter: z.string().optional(),
});

export type FacturasVentaQuery = z.infer<typeof FacturasVentaQuerySchema>;
