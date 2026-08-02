/**
 * PATCH /api/centros-costo/[id]  — editar nombre/código y/o activar-desactivar
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getAuthenticatedUser, puedeGestionarFinanzas } from '@/app/api/_helpers';
import { ActualizarCentroCostoSchema } from '@/lib/validations/centros-costo.schema';
import { mapCentroCostoRow } from '@/lib/services/mappers';

// Nunca cachear: cada respuesta depende del usuario autenticado y de datos que cambian por request.
export const dynamic = 'force-dynamic';

interface RouteParams { params: { id: string } }

export async function PATCH(request: Request, { params }: RouteParams) {
  const user = await getAuthenticatedUser(request);
  if (!user)                         return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!puedeGestionarFinanzas(user)) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const parsed = ActualizarCentroCostoSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 });

  try {
    const { data: centro, error } = await supabaseAdmin
      .from('centros_costo')
      .update(parsed.data)
      .eq('id', params.id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!centro) return NextResponse.json({ error: 'Centro de costo no encontrado' }, { status: 404 });

    return NextResponse.json({ ok: true, data: mapCentroCostoRow(centro) });
  } catch (e) {
    if ((e as { code?: string }).code === '23505') {
      return NextResponse.json({ error: 'Ya existe un centro de costo con ese código' }, { status: 409 });
    }
    console.error(`[PATCH /api/centros-costo/${params.id}]`, e);
    return NextResponse.json({ error: 'Error al actualizar centro de costo' }, { status: 500 });
  }
}
