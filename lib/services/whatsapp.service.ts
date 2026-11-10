/**
 * whatsapp.service.ts — integración con WhatsApp Cloud API (Meta), para que
 * app/api/whatsapp/webhook pueda recibir mensajes de clientes y responderles.
 *
 * `extraerMensajeTexto` es lógica pura (sin I/O) — testeable directamente,
 * igual que woocommerce.service.ts. `enviarMensajeTexto`/`marcarComoLeido`
 * sí hacen I/O (fetch al Graph API de Meta).
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { WhatsAppWebhookPayload } from '@/lib/validations/whatsapp.schema';

const GRAPH_API_VERSION = 'v22.0';

export interface MensajeEntrante {
  telefono: string;
  nombreContacto: string;
  texto: string;
  messageId: string;
}

/**
 * Verifica la firma `X-Hub-Signature-256: sha256=<hex>` (HMAC-SHA256 en hex
 * sobre el body crudo, con el App Secret de Meta) — a diferencia de la firma
 * de WooCommerce, que es base64. Compara con `timingSafeEqual` para no
 * filtrar el secreto por temporización.
 */
export function verificarFirmaWebhook(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
): boolean {
  if (!signatureHeader || !appSecret) return false;

  const prefijo = 'sha256=';
  if (!signatureHeader.startsWith(prefijo)) return false;
  const firmaRecibida = signatureHeader.slice(prefijo.length);

  const firmaEsperada = createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex');

  const bufEsperada = Buffer.from(firmaEsperada, 'utf8');
  const bufRecibida = Buffer.from(firmaRecibida, 'utf8');
  if (bufEsperada.length !== bufRecibida.length) return false;

  return timingSafeEqual(bufEsperada, bufRecibida);
}

/**
 * Extrae el primer mensaje de texto entrante del payload, o null si el
 * webhook no trae ninguno (ej. es sólo una actualización de estado
 * "delivered"/"read", o un mensaje que no es de texto — imagen, audio, etc.,
 * que por ahora no procesamos).
 */
export function extraerMensajeTexto(payload: WhatsAppWebhookPayload): MensajeEntrante | null {
  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      const mensaje = change.value.messages?.find((m) => m.type === 'text' && m.text);
      if (!mensaje?.text) continue;

      const contacto = change.value.contacts?.find((c) => c.wa_id === mensaje.from);

      return {
        telefono: mensaje.from,
        nombreContacto: contacto?.profile?.name ?? '',
        texto: mensaje.text.body,
        messageId: mensaje.id,
      };
    }
  }
  return null;
}

function requireEnv(name: string): string {
  const valor = process.env[name];
  if (!valor) throw new Error(`Falta la variable de entorno ${name}`);
  return valor;
}

/**
 * Envía un mensaje de texto a un número de WhatsApp vía el Graph API de Meta.
 * Requiere WHATSAPP_ACCESS_TOKEN (token del System User / app de Meta) y
 * WHATSAPP_PHONE_NUMBER_ID (el número de WhatsApp Business del taller).
 */
export async function enviarMensajeTexto(telefono: string, texto: string): Promise<void> {
  const token = requireEnv('WHATSAPP_ACCESS_TOKEN');
  const phoneNumberId = requireEnv('WHATSAPP_PHONE_NUMBER_ID');

  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: telefono,
        type: 'text',
        text: { body: texto },
      }),
    },
  );

  if (!response.ok) {
    const detalle = await response.text().catch(() => '');
    throw new Error(`Error al enviar mensaje de WhatsApp (${response.status}): ${detalle}`);
  }
}

/** Marca un mensaje entrante como leído — puramente cosmético (el check azul); no bloquea el flujo si falla. */
export async function marcarComoLeido(messageId: string): Promise<void> {
  const token = requireEnv('WHATSAPP_ACCESS_TOKEN');
  const phoneNumberId = requireEnv('WHATSAPP_PHONE_NUMBER_ID');

  await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    }),
  }).catch((e) => console.error('[whatsapp.marcarComoLeido]', e));
}
