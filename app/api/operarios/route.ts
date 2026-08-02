/**
 * GET  /api/operarios  — lista operarios (filtro opcional `activo`)
 * POST /api/operarios  — crea un operario
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getAuthenticatedUser, canWrite } from '@/app/api/_helpers';
import { OperarioSchema, OperariosQuerySchema } from '@/lib/validations/produccion.schema';
import { mapOperarioRow } from '@/lib/services/mappers';

// Nunca cachear: cada respuesta depende del usuario autenticado y de datos que cambian por request.
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const qp = OperariosQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!qp.success) return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });

  try {
    let query = supabaseAdmin.from('operarios').select('*').order('nombre');
    if (qp.data.activo !== undefined) query = query.eq('activo', qp.data.activo);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ ok: true, data: (data ?? []).map(mapOperarioRow) });
  } catch (e) {
    console.error('[GET /api/operarios]', e);
    return NextResponse.json({ error: 'Error al obtener operarios' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user)           return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const parsed = OperarioSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 });

  try {
    const { data: operario, error } = await supabaseAdmin
      .from('operarios')
      .insert({ nombre: parsed.data.nombre, activo: parsed.data.activo })
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ ok: true, data: mapOperarioRow(operario) }, { status: 201 });
  } catch (e) {
    console.error('[POST /api/operarios]', e);
    return NextResponse.json({ error: 'Error al crear operario' }, { status: 500 });
  }
}
