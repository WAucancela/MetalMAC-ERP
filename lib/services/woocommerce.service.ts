/**
 * woocommerce.service.ts — lógica pura para la ingesta de pedidos de tallermac.com.
 *
 * Sin I/O (ni fetch ni Supabase) — testeable directamente, igual que sri.service.ts.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { WooCommerceLineItemSchema } from '@/lib/validations/pedidos-woocommerce.schema';
import type { z } from 'zod';

type WooCommerceLineItem = z.infer<typeof WooCommerceLineItemSchema>;

/**
 * Verifica la firma `X-WC-Webhook-Signature` (HMAC-SHA256 en base64 sobre el body
 * crudo, con el secreto configurado en WooCommerce → Ajustes → Avanzado → Webhooks).
 * Compara con `timingSafeEqual` para no filtrar el secreto por temporización; ambos
 * buffers deben tener igual longitud antes de comparar (si no, es inválida directo).
 */
export function verificarFirmaWebhook(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader || !secret) return false;

  const esperada = createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');

  const bufEsperada = Buffer.from(esperada, 'utf8');
  const bufRecibida = Buffer.from(signatureHeader, 'utf8');
  if (bufEsperada.length !== bufRecibida.length) return false;

  return timingSafeEqual(bufEsperada, bufRecibida);
}

/**
 * Resuelve el producto interno correspondiente a un SKU de WooCommerce por coincidencia
 * exacta (case-insensitive) con `productos.codigo`. Sin fuzzy matching — un match
 * incorrecto asignaría mal una orden de producción.
 */
export function resolverProductoPorSku(
  sku: string,
  productos: { id: string; codigo: string }[],
): string | null {
  const skuNormalizado = sku.trim().toLowerCase();
  if (!skuNormalizado) return null;

  const match = productos.find((p) => p.codigo.trim().toLowerCase() === skuNormalizado);
  return match?.id ?? null;
}

/**
 * Filtra los line_items del payload entrante que ya tienen una línea convertida en OP,
 * para no reinsertarlos ni pisar una orden de producción ya creada cuando WooCommerce
 * reenvía el pedido actualizado (ej. cambio de estado a "completed").
 */
export function calcularLineasAInsertar(
  lineItems: WooCommerceLineItem[],
  lineasYaConvertidas: { wcLineItemId: number }[],
): WooCommerceLineItem[] {
  const idsConvertidos = new Set(lineasYaConvertidas.map((l) => l.wcLineItemId));
  return lineItems.filter((li) => !idsConvertidos.has(li.id));
}
