/**
 * PATCH /api/ordenes-produccion/[id]/operaciones/[opId]
 *
 * Dos acciones posibles según el body:
 *   { operarioId: string | null }                     → asigna/desasigna operario
 *   { estado: 'COMPLETADA', minutosReales: number }    → marca la operación como completada
 *
 * Sólo se puede tocar una operación mientras la OP que la contiene está EN_PROCESO,
 * y sólo se puede completar una operación que esté PENDIENTE.
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getAuthenticatedUser, canWrite } from '@/app/api/_helpers';
import { AsignarOperacionSchema, CompletarOperacionSchema } from '@/lib/validations/produccion.schema';
import { mapOrdenOperacionRow } from '@/lib/services/mappers';

// Nunca cachear: cada respuesta depende del usuario autenticado y de datos que cambian por request.
export const dynamic = 'force-dynamic';

interface RouteParams { params: { id: string; opId: string } }

export async function PATCH(request: Request, { params }: RouteParams) {
  const user = await getAuthenticatedUser(request);
  if (!user)           return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const esCompletar = typeof body === 'object' && body !== null && 'estado' in body;
  const parsed = esCompletar ? CompletarOperacionSchema.safeParse(body) : AsignarOperacionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 });

  try {
    const { data: operacion, error: opError } = await supabaseAdmin
      .from('orden_operaciones')
      .select('*, ordenes_produccion!inner(estado)')
      .eq('id', params.opId)
      .eq('orden_id', params.id)
      .maybeSingle();
    if (opError) throw opError;
    if (!operacion) return NextResponse.json({ error: 'Operación no encontrada' }, { status: 404 });

    if (operacion.ordenes_produccion.estado !== 'EN_PROCESO') {
      return NextResponse.json(
        { error: 'Sólo se pueden modificar operaciones de una OP en proceso' },
        { status: 409 },
      );
    }

    if (esCompletar) {
      if (operacion.estado === 'COMPLETADA') {
        return NextResponse.json({ error: 'La operación ya está completada' }, { status: 409 });
      }
      const { minutosReales } = parsed.data as { estado: 'COMPLETADA'; minutosReales: number };
      const { data: updated, error } = await supabaseAdmin
        .from('orden_operaciones')
        .update({
          estado: 'COMPLETADA',
          minutos_reales: minutosReales,
          completada_en: new Date().toISOString(),
          completada_por: user.uid,
        })
        .eq('id', params.opId)
        .select('*, operarios(nombre), tipos_operacion(nombre)')
        .single();
      if (error) throw error;

      return NextResponse.json({ ok: true, data: mapOrdenOperacionRow(updated) });
    }

    const { operarioId } = parsed.data as { operarioId: string | null };
    const { data: updated, error } = await supabaseAdmin
      .from('orden_operaciones')
      .update({ operario_id: operarioId })
      .eq('id', params.opId)
      .select('*, operarios(nombre), tipos_operacion(nombre)')
      .single();
    if (error) throw error;

    return NextResponse.json({ ok: true, data: mapOrdenOperacionRow(updated) });
  } catch (e) {
    console.error(`[PATCH /api/ordenes-produccion/${params.id}/operaciones/${params.opId}]`, e);
    return NextResponse.json({ error: 'Error al actualizar la operación' }, { status: 500 });
  }
}
