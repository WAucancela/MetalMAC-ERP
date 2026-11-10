/**
 * Tests unitarios para whatsapp.service.ts
 *
 * - verificarFirmaWebhook: firma válida, inválida, header ausente, formato distinto
 *   al de WooCommerce (hex con prefijo "sha256=", no base64)
 * - extraerMensajeTexto: mensaje de texto, payload de "statuses" sin mensajes,
 *   mensaje que no es de texto, nombre de contacto ausente
 *
 * NO requiere Supabase ni el Graph API de Meta — el servicio no hace I/O en
 * estas dos funciones.
 */
import { createHmac } from 'node:crypto';
import { verificarFirmaWebhook, extraerMensajeTexto } from '../lib/services/whatsapp.service';
import type { WhatsAppWebhookPayload } from '../lib/validations/whatsapp.schema';

// ─────────────────────────────────────────────
// verificarFirmaWebhook
// ─────────────────────────────────────────────

describe('verificarFirmaWebhook', () => {
  const secret = 'un-app-secret-de-prueba';
  const rawBody = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });

  function firmar(body: string, s: string): string {
    return `sha256=${createHmac('sha256', s).update(body, 'utf8').digest('hex')}`;
  }

  it('acepta una firma válida', () => {
    const firma = firmar(rawBody, secret);
    expect(verificarFirmaWebhook(rawBody, firma, secret)).toBe(true);
  });

  it('rechaza una firma calculada con otro secreto', () => {
    const firma = firmar(rawBody, 'otro-secreto');
    expect(verificarFirmaWebhook(rawBody, firma, secret)).toBe(false);
  });

  it('rechaza una firma de otro body (payload alterado)', () => {
    const firma = firmar(rawBody, secret);
    const otroBody = JSON.stringify({ object: 'whatsapp_business_account', entry: [{}] });
    expect(verificarFirmaWebhook(otroBody, firma, secret)).toBe(false);
  });

  it('rechaza si no hay header de firma', () => {
    expect(verificarFirmaWebhook(rawBody, null, secret)).toBe(false);
  });

  it('rechaza si el secreto está vacío', () => {
    const firma = firmar(rawBody, secret);
    expect(verificarFirmaWebhook(rawBody, firma, '')).toBe(false);
  });

  it('rechaza un header sin el prefijo sha256=', () => {
    const firmaSinPrefijo = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
    expect(verificarFirmaWebhook(rawBody, firmaSinPrefijo, secret)).toBe(false);
  });
});

// ─────────────────────────────────────────────
// extraerMensajeTexto
// ─────────────────────────────────────────────

function buildPayload(value: Partial<WhatsAppWebhookPayload['entry'][0]['changes'][0]['value']>): WhatsAppWebhookPayload {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'entry-1',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { phone_number_id: '123456' },
              ...value,
            },
          },
        ],
      },
    ],
  };
}

describe('extraerMensajeTexto', () => {
  it('extrae teléfono, nombre y texto de un mensaje de texto', () => {
    const payload = buildPayload({
      contacts: [{ wa_id: '593991234567', profile: { name: 'Juan Pérez' } }],
      messages: [{ from: '593991234567', id: 'wamid.1', timestamp: '1700000000', type: 'text', text: { body: 'Hola, necesito 10 pernos' } }],
    });

    expect(extraerMensajeTexto(payload)).toEqual({
      telefono: '593991234567',
      nombreContacto: 'Juan Pérez',
      texto: 'Hola, necesito 10 pernos',
      messageId: 'wamid.1',
    });
  });

  it('devuelve null si el payload sólo trae "statuses" (sin messages)', () => {
    const payload = buildPayload({});
    expect(extraerMensajeTexto(payload)).toBeNull();
  });

  it('devuelve null si el único mensaje no es de tipo texto', () => {
    const payload = buildPayload({
      messages: [{ from: '593991234567', id: 'wamid.2', timestamp: '1700000000', type: 'image' }],
    });
    expect(extraerMensajeTexto(payload)).toBeNull();
  });

  it('usa nombreContacto vacío si no hay contacto para ese wa_id', () => {
    const payload = buildPayload({
      messages: [{ from: '593991234567', id: 'wamid.3', timestamp: '1700000000', type: 'text', text: { body: 'Hola' } }],
    });
    expect(extraerMensajeTexto(payload)?.nombreContacto).toBe('');
  });
});
