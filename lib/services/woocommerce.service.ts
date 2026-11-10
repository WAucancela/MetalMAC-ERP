/**
 * woocommerce.service.ts — lógica pura para la integración con tallermac.com.
 *
 * Cubre las dos direcciones:
 * - Ingesta de pedidos de tallermac.com hacia el ERP.
 * - Publicación de productos del ERP hacia tallermac.com.
 *
 * Sin I/O (ni fetch ni Supabase) — testeable directamente, igual que sri.service.ts.
 * El I/O real de la publicación (las llamadas a la REST API de WooCommerce) vive en
 * woocommerce-api.service.ts, que usa `construirPayloadProductoWC` de acá.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { WooCommerceLineItemSchema } from '@/lib/validations/pedidos-woocommerce.schema';
import type { z } from 'zod';
import type { Producto } from '@/types/metalmac.types';

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

// ─────────────────────────────────────────────
// Publicación de productos del ERP → WooCommerce
// ─────────────────────────────────────────────

/** Cuerpo que acepta `POST`/`PUT /wp-json/wc/v3/products` — solo los campos que seteamos. */
export interface PayloadProductoWC {
  name: string;
  sku: string;
  description: string;
  regular_price: string;
  status: 'publish' | 'draft';
  manage_stock: false;
  stock_status: 'instock';
  images?: { src: string }[];
}

/**
 * Parsea el campo `imagenUrls` (una URL por línea, tal como se escribe en el
 * formulario) a la lista de URLs no vacías que efectivamente se mandan a WooCommerce.
 * Ignora líneas en blanco — así el staff puede dejar líneas sueltas al editar sin
 * que cuenten como una URL vacía.
 */
export function parsearUrlsImagenes(imagenUrls: string): string[] {
  return imagenUrls
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '');
}

/**
 * Construye el payload de WooCommerce a partir de un producto del ERP.
 *
 * No depende de si el producto ya existe en WooCommerce (eso lo decide
 * woocommerce-api.service.ts según `wcProductId`) — siempre arma el mismo cuerpo,
 * válido tanto para crear como para actualizar. Al actualizar, la lista de
 * `images` que se manda reemplaza por completo las imágenes del producto en
 * WooCommerce (comportamiento estándar de su REST API) — no se agregan, se
 * sincronizan con lo que diga `imagenUrls` en ese momento.
 *
 * `manage_stock: false` + `stock_status: 'instock'` a propósito: la fabricación acá
 * es a pedido (sin stock de producto terminado en el modelo del ERP), así que un
 * producto publicado siempre se ofrece como disponible en vez de sincronizar una
 * cantidad que no existe.
 *
 * `status: 'draft'` cuando no hay ninguna imagen — evita publicar en la tienda un
 * producto sin foto; queda como borrador en WooCommerce hasta que alguien le ponga
 * `imagenUrls` y lo vuelva a publicar.
 */
export function construirPayloadProductoWC(producto: Producto): PayloadProductoWC {
  const urls = parsearUrlsImagenes(producto.imagenUrls);

  return {
    name: producto.nombre,
    sku: producto.codigo,
    description: producto.descripcion,
    regular_price: producto.precioVenta.toFixed(2),
    status: urls.length > 0 ? 'publish' : 'draft',
    manage_stock: false,
    stock_status: 'instock',
    ...(urls.length > 0 ? { images: urls.map((src) => ({ src })) } : {}),
  };
}

/**
 * Valida si un producto del ERP puede publicarse en la tienda. Solo productos
 * terminados y activos — un semielaborado no se vende suelto, y uno inactivo no
 * debería ofrecerse aunque ya hubiera sido publicado antes.
 */
export function puedePublicarseEnTienda(producto: Pick<Producto, 'tipo' | 'activo'>): boolean {
  return producto.tipo === 'PRODUCTO_TERMINADO' && producto.activo;
}
