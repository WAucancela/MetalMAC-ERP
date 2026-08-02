/**
 * GET  /api/centros-costo  — lista centros de costo (filtro opcional `activo`)
 * POST /api/centros-costo  — crea un centro de costo
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getAuthenticatedUser, puedeGestionarFinanzas } from '@/app/api/_helpers';
import { CentroCostoSchema, CentrosCostoQuerySchema } from '@/lib/validations/centros-costo.schema';
import { mapCentroCostoRow } from '@/lib/services/mappers';

// Nunca cachear: cada respuesta depende del usuario autenticado y de datos que cambian por request.
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const qp = CentrosCostoQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!qp.success) return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });

  try {
    let query = supabaseAdmin.from('centros_costo').select('*').order('nombre');
    if (qp.data.activo !== undefined) query = query.eq('activo', qp.data.activo);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ ok: true, data: (data ?? []).map(mapCentroCostoRow) });
  } catch (e) {
    console.error('[GET /api/centros-costo]', e);
    return NextResponse.json({ error: 'Error al obtener centros de costo' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user)                         return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!puedeGestionarFinanzas(user)) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const parsed = CentroCostoSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 });

  try {
    const { data: centro, error } = await supabaseAdmin
      .from('centros_costo')
      .insert({ codigo: parsed.data.codigo, nombre: parsed.data.nombre, activo: parsed.data.activo })
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ ok: true, data: mapCentroCostoRow(centro) }, { status: 201 });
  } catch (e) {
    if ((e as { code?: string }).code === '23505') {
      return NextResponse.json({ error: 'Ya existe un centro de costo con ese código' }, { status: 409 });
    }
    console.error('[POST /api/centros-costo]', e);
    return NextResponse.json({ error: 'Error al crear centro de costo' }, { status: 500 });
  }
}
