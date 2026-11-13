/**
 * GET   /api/solicitudes-contacto/[id] — detalle de una solicitud de contacto
 * PATCH /api/solicitudes-contacto/[id] — marcar CONTACTADA / DESCARTADA
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getAuthenticatedUser } from '@/app/api/_helpers';
import { ActualizarEstadoSolicitudSchema } from '@/lib/validations/solicitudes-contacto.schema';
import { mapSolicitudContactoRow } from '@/lib/services/mappers';

export const dynamic = 'force-dynamic';

interface RouteParams { params: { id: string } }

function puedeRevisarSolicitudes(rol: string): boolean {
  return ['GERENTE', 'PRODUCCION'].includes(rol);
}

export async function GET(request: Request, { params }: RouteParams) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!puedeRevisarSolicitudes(user.rol)) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  try {
    const { data: solicitud, error } = await supabaseAdmin
      .from('solicitudes_contacto')
      .select('*')
      .eq('id', params.id)
      .maybeSingle();
    if (error) throw error;
    if (!solicitud) return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });

    return NextResponse.json({ ok: true, data: mapSolicitudContactoRow(solicitud) });
  } catch (e) {
    console.error(`[GET /api/solicitudes-contacto/${params.id}]`, e);
    return NextResponse.json({ error: 'Error al obtener solicitud' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!puedeRevisarSolicitudes(user.rol)) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const parsed = ActualizarEstadoSolicitudSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 });

  try {
    const { data: solicitud, error: findError } = await supabaseAdmin
      .from('solicitudes_contacto')
      .select('id')
      .eq('id', params.id)
      .maybeSingle();
    if (findError) throw findError;
    if (!solicitud) return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });

    const { error: updateError } = await supabaseAdmin
      .from('solicitudes_contacto')
      .update({ estado: parsed.data.estado })
      .eq('id', params.id);
    if (updateError) throw updateError;

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(`[PATCH /api/solicitudes-contacto/${params.id}]`, e);
    return NextResponse.json({ error: 'Error al actualizar solicitud' }, { status: 500 });
  }
}
