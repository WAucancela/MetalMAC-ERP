/**
 * GET /api/whatsapp/conversaciones/[id] — detalle de una conversación de
 * WhatsApp, con el historial ya interpretado como timeline de mensajes
 * (ver lib/services/whatsapp-historial.ts) para que el dashboard no tenga
 * que conocer la forma de los content blocks del SDK de Anthropic.
 */
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getAuthenticatedUser } from '@/app/api/_helpers';
import { mapConversacionWhatsAppRow } from '@/lib/services/mappers';

// Nunca cachear: cada respuesta depende del usuario autenticado y de datos que cambian por request.
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const { data, error } = await supabaseAdmin
      .from('whatsapp_conversaciones')
      .select('*')
      .eq('id', params.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 });

    return NextResponse.json({ ok: true, data: mapConversacionWhatsAppRow(data) });
  } catch (e) {
    console.error('[GET /api/whatsapp/conversaciones/[id]]', e);
    return NextResponse.json({ error: 'Error al obtener la conversación' }, { status: 500 });
  }
}
