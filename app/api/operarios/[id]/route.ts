/**
 * PATCH /api/operarios/[id]  — editar nombre y/o activar-desactivar un operario
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getAuthenticatedUser, canWrite } from '@/app/api/_helpers';
import { ActualizarOperarioSchema } from '@/lib/validations/produccion.schema';
import { mapOperarioRow } from '@/lib/services/mappers';

// Nunca cachear: cada respuesta depende del usuario autenticado y de datos que cambian por request.
export const dynamic = 'force-dynamic';

interface RouteParams { params: { id: string } }

export async function PATCH(request: Request, { params }: RouteParams) {
  const user = await getAuthenticatedUser(request);
  if (!user)           return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const parsed = ActualizarOperarioSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 });

  try {
    const { data: operario, error } = await supabaseAdmin
      .from('operarios')
      .update(parsed.data)
      .eq('id', params.id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!operario) return NextResponse.json({ error: 'Operario no encontrado' }, { status: 404 });

    return NextResponse.json({ ok: true, data: mapOperarioRow(operario) });
  } catch (e) {
    console.error(`[PATCH /api/operarios/${params.id}]`, e);
    return NextResponse.json({ error: 'Error al actualizar operario' }, { status: 500 });
  }
}
