/**
 * GET /api/solicitudes-contacto — lista la bandeja de leads del formulario "Cotizar mi
 * Proyecto" de tallermac-web.
 *
 * Sin POST: las solicitudes sólo entran desde tallermac-web (app/api/cotizacion), con la
 * clave anónima de Supabase — nunca creadas a mano desde el ERP.
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  getAuthenticatedUser, encodeCursor, decodeCursor, cursorFilterAntesDe,
} from '@/app/api/_helpers';
import { SolicitudesContactoQuerySchema } from '@/lib/validations/solicitudes-contacto.schema';
import { mapSolicitudContactoRow } from '@/lib/services/mappers';

// Nunca cachear: cada respuesta depende del usuario autenticado y de datos que cambian por request.
export const dynamic = 'force-dynamic';

/** Mismo criterio que /api/pedidos-tienda: triage de leads del sitio web. */
function puedeRevisarSolicitudes(rol: string): boolean {
  return ['GERENTE', 'PRODUCCION'].includes(rol);
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!puedeRevisarSolicitudes(user.rol)) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const qp = SolicitudesContactoQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!qp.success) return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });

  const { estado, limit: pageLimit, startAfter: cursor } = qp.data;

  try {
    let query = supabaseAdmin
      .from('solicitudes_contacto')
      .select('*')
      .order('creado_en', { ascending: false })
      .order('id', { ascending: false });

    if (estado) query = query.eq('estado', estado);

    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (decoded) query = query.or(cursorFilterAntesDe('creado_en', decoded));
    }
    query = query.limit(pageLimit);

    const { data, error } = await query;
    if (error) throw error;

    const rows = data ?? [];
    const solicitudes = rows.map(mapSolicitudContactoRow);

    const last = rows.at(-1);
    const nextCursor =
      rows.length === pageLimit && last
        ? encodeCursor({ valor: last.creado_en, id: last.id })
        : null;

    return NextResponse.json({ ok: true, data: solicitudes, nextCursor });
  } catch (e) {
    console.error('[GET /api/solicitudes-contacto]', e);
    return NextResponse.json({ error: 'Error al obtener solicitudes' }, { status: 500 });
  }
}
