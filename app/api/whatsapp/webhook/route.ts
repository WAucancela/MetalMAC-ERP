/**
 * GET  /api/whatsapp/webhook — handshake de verificación que pide Meta al
 *      configurar el webhook en el dashboard de WhatsApp Cloud API.
 * POST /api/whatsapp/webhook — recibe mensajes entrantes de clientes.
 *
 * Igual que app/api/webhooks/woocommerce: la llamada viene del servidor de
 * Meta, no de un usuario logueado, así que se autentica con la firma HMAC
 * del webhook (WHATSAPP_APP_SECRET) en vez de un Bearer JWT. middleware.ts
 * ya deja pasar todo /api/* sin sesión de Supabase.
 *
 * Siempre responde 200 a un payload válido (incluso si no había texto que
 * procesar, ej. es un "status" de entregado/leído) — devolver error hace que
 * Meta reintente la entrega del mismo webhook una y otra vez.
 */
import { NextResponse } from 'next/server';
import { WhatsAppWebhookPayloadSchema } from '@/lib/validations/whatsapp.schema';
import { verificarFirmaWebhook, extraerMensajeTexto, enviarMensajeTexto, marcarComoLeido } from '@/lib/services/whatsapp.service';
import { procesarMensajeEntrante } from '@/lib/services/whatsapp-agente.service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  if (mode === 'subscribe' && verifyToken && token === verifyToken && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: 'Verificación inválida' }, { status: 403 });
}

export async function POST(request: Request) {
  const rawBody = await request.text();

  const secret = process.env.WHATSAPP_APP_SECRET;
  const firma = request.headers.get('x-hub-signature-256');
  if (!secret || !verificarFirmaWebhook(rawBody, firma, secret)) {
    return NextResponse.json({ error: 'Firma inválida' }, { status: 401 });
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const parsed = WhatsAppWebhookPayloadSchema.safeParse(json);
  if (!parsed.success) {
    // Payload de un tipo de evento que no modelamos (ej. account_update) — no es
    // un error del taller, así que no hace falta que Meta reintente.
    return NextResponse.json({ ok: true });
  }

  const mensaje = extraerMensajeTexto(parsed.data);
  if (!mensaje) {
    // No había mensaje de texto (status de entrega/lectura, u otro tipo de
    // mensaje — imagen, audio — que todavía no procesamos).
    return NextResponse.json({ ok: true });
  }

  try {
    await marcarComoLeido(mensaje.messageId).catch(() => {});
    const respuesta = await procesarMensajeEntrante({
      telefono: mensaje.telefono,
      nombreContacto: mensaje.nombreContacto,
      texto: mensaje.texto,
    });
    await enviarMensajeTexto(mensaje.telefono, respuesta);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[POST /api/whatsapp/webhook]', e);
    // 500 → Meta reintenta la entrega más tarde.
    return NextResponse.json({ error: 'Error al procesar el mensaje' }, { status: 500 });
  }
}
