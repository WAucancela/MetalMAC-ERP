import { z } from 'zod';

// ─────────────────────────────────────────────
// Payload entrante del webhook de WooCommerce
// ─────────────────────────────────────────────
//
// Shape mínimo que usamos del payload real de WooCommerce (Store/REST API "order"
// object) — .passthrough() porque WooCommerce manda muchos más campos que ignoramos.
// `total` viaja como string (convención de la API de WooCommerce, no un número JSON).

export const WooCommerceLineItemSchema = z
  .object({
    id: z.number(),
    sku: z.string().optional().default(''),
    name: z.string(),
    quantity: z.number().positive(),
  })
  .passthrough();

export const WooCommerceWebhookPayloadSchema = z
  .object({
    id: z.number(),
    status: z.string(),
    number: z.string(),
    currency: z.string().default('USD'),
    total: z.string(),
    billing: z
      .object({
        first_name: z.string().optional().default(''),
        last_name: z.string().optional().default(''),
        email: z.string().optional().default(''),
      })
      .partial()
      .default({}),
    line_items: z.array(WooCommerceLineItemSchema).default([]),
  })
  .passthrough();

export type WooCommerceWebhookPayload = z.infer<typeof WooCommerceWebhookPayloadSchema>;

// ─────────────────────────────────────────────
// Bandeja de revisión
// ─────────────────────────────────────────────

export const PedidosWooCommerceQuerySchema = z.object({
  estadoRevision: z.enum(['PENDIENTE', 'EN_REVISION', 'CONVERTIDO', 'RECHAZADO']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  startAfter: z.string().optional(),
});

export type PedidosWooCommerceQuery = z.infer<typeof PedidosWooCommerceQuerySchema>;

export const ActualizarEstadoRevisionSchema = z.object({
  estadoRevision: z.enum(['EN_REVISION', 'CONVERTIDO', 'RECHAZADO']),
  notas: z.string().max(500).optional(),
});

export type ActualizarEstadoRevisionInput = z.infer<typeof ActualizarEstadoRevisionSchema>;

export const ConvertirLineaPedidoSchema = z.object({
  productoId: z.string().min(1),
  cantidad: z.number().int().positive(),
  fechaEntrega: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato ISO: YYYY-MM-DD'),
  proyectoId: z.string().optional(),
  notas: z.string().max(500).default(''),
});

export type ConvertirLineaPedidoInput = z.infer<typeof ConvertirLineaPedidoSchema>;
