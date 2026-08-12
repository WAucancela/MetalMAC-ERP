/**
 * GET  /api/tipos-operacion  — lista tipos de operación (filtro opcional `activo`)
 * POST /api/tipos-operacion  — crea un tipo de operación
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getAuthenticatedUser, canWrite } from '@/app/api/_helpers';
import { TipoOperacionSchema, TiposOperacionQuerySchema } from '@/lib/validations/produccion.schema';
import { mapTipoOperacionRow } from '@/lib/services/mappers';

// Nunca cachear: cada respuesta depende del usuario autenticado y de datos que cambian por request.
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const qp = TiposOperacionQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!qp.success) return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });

  try {
    let query = supabaseAdmin.from('tipos_operacion').select('*').order('nombre');
    if (qp.data.activo !== undefined) query = query.eq('activo', qp.data.activo);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ ok: true, data: (data ?? []).map(mapTipoOperacionRow) });
  } catch (e) {
    console.error('[GET /api/tipos-operacion]', e);
    return NextResponse.json({ error: 'Error al obtener tipos de operación' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user)           return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const parsed = TipoOperacionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 });

  try {
    const { data: tipoOperacion, error } = await supabaseAdmin
      .from('tipos_operacion')
      .insert({ nombre: parsed.data.nombre, activo: parsed.data.activo })
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ ok: true, data: mapTipoOperacionRow(tipoOperacion) }, { status: 201 });
  } catch (e) {
    console.error('[POST /api/tipos-operacion]', e);
    return NextResponse.json({ error: 'Error al crear el tipo de operación' }, { status: 500 });
  }
}
