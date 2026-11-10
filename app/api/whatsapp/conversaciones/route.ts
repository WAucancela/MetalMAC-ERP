/**
 * GET /api/whatsapp/conversaciones — lista paginada de conversaciones del
 * agente de ventas de WhatsApp, para que el staff pueda revisarlas desde el
 * dashboard (/whatsapp). Sólo lectura — las conversaciones las crea/actualiza
 * el webhook (app/api/whatsapp/webhook), no el staff.
 */
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getAuthenticatedUser } from '@/app/api/_helpers';
import { WhatsAppConversacionesQuerySchema } from '@/lib/validations/whatsapp.schema';
import { mapConversacionWhatsAppResumenRow } from '@/lib/services/mappers';

// Nunca cachear: cada respuesta depende del usuario autenticado y de datos que cambian por request.
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const qp = WhatsAppConversacionesQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!qp.success) return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });

  const { estado, q: term, limit: pageLimit, page } = qp.data;

  try {
    let query = supabaseAdmin
      .from('whatsapp_conversaciones')
      .select('*', { count: 'exact' })
      .order('actualizado_en', { ascending: false });

    if (estado) query = query.eq('estado', estado);
    if (term)   query = query.or(`telefono.ilike.%${term}%,nombre_contacto.ilike.%${term}%`);

    const from = (page - 1) * pageLimit;
    const to   = from + pageLimit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) throw error;

    return NextResponse.json({
      ok: true,
      data: (data ?? []).map(mapConversacionWhatsAppResumenRow),
      total: count ?? 0,
      page,
      limit: pageLimit,
    });
  } catch (e) {
    console.error('[GET /api/whatsapp/conversaciones]', e);
    return NextResponse.json({ error: 'Error al obtener las conversaciones' }, { status: 500 });
  }
}
