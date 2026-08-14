/**
 * PATCH /api/cotizaciones/[id]/estado — el cliente respondió: marca la cotización
 * como APROBADA o RECHAZADA. Solo tiene sentido sobre una que ya se envió (o que
 * venció y el cliente igual responde tarde) — nunca sobre un borrador.
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getAuthenticatedUser, canWrite, puedeGestionarFinanzas } from '@/app/api/_helpers';
import { CambiarEstadoCotizacionSchema } from '@/lib/validations/cotizaciones.schema';

// Nunca cachear: cada respuesta depende del usuario autenticado y de datos que cambian por request.
export const dynamic = 'force-dynamic';

interface RouteParams { params: { id: string } }

export async function PATCH(request: Request, { params }: RouteParams) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canWrite(user) && !puedeGestionarFinanzas(user)) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
  }

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const parsed = CambiarEstadoCotizacionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 });

  try {
    const { data: existente, error: fetchError } = await supabaseAdmin
      .from('cotizaciones')
      .select('id, estado')
      .eq('id', params.id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!existente) return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });
    if (existente.estado !== 'ENVIADA' && existente.estado !== 'VENCIDA') {
      return NextResponse.json(
        { error: 'Solo se puede aprobar o rechazar una cotización que ya fue enviada' },
        { status: 409 },
      );
    }

    const { error } = await supabaseAdmin
      .from('cotizaciones')
      .update({ estado: parsed.data.estado })
      .eq('id', params.id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(`[PATCH /api/cotizaciones/${params.id}/estado]`, e);
    return NextResponse.json({ error: 'Error al actualizar el estado' }, { status: 500 });
  }
}
