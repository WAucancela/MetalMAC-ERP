/**
 * PATCH /api/tipos-operacion/[id]  — editar nombre y/o activar-desactivar un tipo de operación
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getAuthenticatedUser, canWrite } from '@/app/api/_helpers';
import { ActualizarTipoOperacionSchema } from '@/lib/validations/produccion.schema';
import { mapTipoOperacionRow } from '@/lib/services/mappers';

// Nunca cachear: cada respuesta depende del usuario autenticado y de datos que cambian por request.
export const dynamic = 'force-dynamic';

interface RouteParams { params: { id: string } }

export async function PATCH(request: Request, { params }: RouteParams) {
  const user = await getAuthenticatedUser(request);
  if (!user)           return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const parsed = ActualizarTipoOperacionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 });

  try {
    const { data: tipoOperacion, error } = await supabaseAdmin
      .from('tipos_operacion')
      .update(parsed.data)
      .eq('id', params.id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!tipoOperacion) return NextResponse.json({ error: 'Tipo de operación no encontrado' }, { status: 404 });

    return NextResponse.json({ ok: true, data: mapTipoOperacionRow(tipoOperacion) });
  } catch (e) {
    console.error(`[PATCH /api/tipos-operacion/${params.id}]`, e);
    return NextResponse.json({ error: 'Error al actualizar el tipo de operación' }, { status: 500 });
  }
}
