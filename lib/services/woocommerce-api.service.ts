/**
 * woocommerce-api.service.ts — único lugar del repo que habla con la REST API de
 * WooCommerce (tallermac.com) para publicar productos. Sin librería
 * `@woocommerce/woocommerce-rest-api` — un solo endpoint (`/products[/:id]`),
 * autenticado con Basic Auth (Consumer Key/Secret) sobre HTTPS, igual criterio que
 * sri-soap.service.ts: se arma a mano con `fetch` en vez de esconder la llamada
 * detrás de una librería.
 *
 * Dirección ERP → WooCommerce (crear/actualizar un producto). Para la dirección
 * contraria (pedidos entrantes) ver woocommerce.service.ts + el webhook.
 */
import type { PayloadProductoWC } from '@/lib/services/woocommerce.service';

export interface WooCommerceCredenciales {
  apiUrl: string;        // ej. "https://tallermac.com" (sin slash final)
  consumerKey: string;
  consumerSecret: string;
}

export interface ProductoPublicadoWC {
  id: number;
  permalink: string;
}

function leerCredenciales(): WooCommerceCredenciales {
  const apiUrl = process.env.WOOCOMMERCE_API_URL;
  const consumerKey = process.env.WOOCOMMERCE_CONSUMER_KEY;
  const consumerSecret = process.env.WOOCOMMERCE_CONSUMER_SECRET;
  if (!apiUrl || !consumerKey || !consumerSecret) {
    throw new Error(
      'Falta configurar WOOCOMMERCE_API_URL, WOOCOMMERCE_CONSUMER_KEY o WOOCOMMERCE_CONSUMER_SECRET',
    );
  }
  return { apiUrl: apiUrl.replace(/\/$/, ''), consumerKey, consumerSecret };
}

function authHeader(cred: WooCommerceCredenciales): string {
  return 'Basic ' + Buffer.from(`${cred.consumerKey}:${cred.consumerSecret}`).toString('base64');
}

async function llamarWC(
  cred: WooCommerceCredenciales,
  path: string,
  init: RequestInit,
): Promise<any> {
  const res = await fetch(`${cred.apiUrl}/wp-json/wc/v3${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: authHeader(cred),
      'Content-Type': 'application/json',
    },
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const mensaje = json?.message ?? `WooCommerce respondió ${res.status}`;
    throw new Error(mensaje);
  }
  return json;
}

/** Crea el producto en WooCommerce. Usar solo cuando el producto del ERP todavía no tiene `wcProductId`. */
export async function crearProductoWC(payload: PayloadProductoWC): Promise<ProductoPublicadoWC> {
  const cred = leerCredenciales();
  const data = await llamarWC(cred, '/products', { method: 'POST', body: JSON.stringify(payload) });
  return { id: data.id, permalink: data.permalink };
}

/** Actualiza un producto ya publicado. `wcProductId` debe ser el id devuelto por una publicación previa. */
export async function actualizarProductoWC(
  wcProductId: number,
  payload: PayloadProductoWC,
): Promise<ProductoPublicadoWC> {
  const cred = leerCredenciales();
  const data = await llamarWC(cred, `/products/${wcProductId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return { id: data.id, permalink: data.permalink };
}
