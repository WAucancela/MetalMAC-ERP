/**
 * PATCH /api/bancos/movimientos/[id]  — marcar/desmarcar un movimiento como conciliado
 */

import { NextResponse } from 'next/server';
import { getAuthenticatedUser, canWrite, puedeGestionarFinanzas } from '@/app/api/_helpers';
import { ConciliarMovimientoSchema } from '@/lib/validations/bancos.schema';
import { marcarConciliado } from '@/lib/services/bancos.service';

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

  const parsed = ConciliarMovimientoSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 });

  try {
    await marcarConciliado(params.id, parsed.data.conciliado);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(`[PATCH /api/bancos/movimientos/${params.id}]`, e);
    return NextResponse.json({ error: 'Error al actualizar el movimiento' }, { status: 500 });
  }
}
