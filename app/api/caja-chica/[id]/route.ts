/**
 * PUT    /api/caja-chica/[id]  — corrige un movimiento de caja chica ya registrado
 *                                (typo en el concepto, monto o fecha mal tipeados).
 * DELETE /api/caja-chica/[id]  — elimina un movimiento cargado por error.
 * Mismo criterio de permisos que POST /api/caja-chica en ambos casos.
 */

import { NextResponse } from 'next/server';
import { getAuthenticatedUser, canWrite, puedeGestionarFinanzas } from '@/app/api/_helpers';
import { ActualizarCajaMovimientoSchema } from '@/lib/validations/caja.schema';
import { actualizarMovimientoCaja, eliminarMovimientoCaja } from '@/lib/services/caja.service';
import { mapCajaMovimientoRow } from '@/lib/services/mappers';

// Nunca cachear: cada respuesta depende del usuario autenticado y de datos que cambian por request.
export const dynamic = 'force-dynamic';

interface RouteParams { params: { id: string } }

export async function PUT(request: Request, { params }: RouteParams) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canWrite(user) && !puedeGestionarFinanzas(user)) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
  }

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const parsed = ActualizarCajaMovimientoSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 });

  try {
    const movimiento = await actualizarMovimientoCaja(params.id, parsed.data);
    if (!movimiento) return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 });
    return NextResponse.json({ ok: true, data: mapCajaMovimientoRow(movimiento) });
  } catch (e) {
    console.error(`[PUT /api/caja-chica/${params.id}]`, e);
    return NextResponse.json({ error: 'Error al actualizar el movimiento' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canWrite(user) && !puedeGestionarFinanzas(user)) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
  }

  try {
    const eliminado = await eliminarMovimientoCaja(params.id);
    if (!eliminado) return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(`[DELETE /api/caja-chica/${params.id}]`, e);
    return NextResponse.json({ error: 'Error al eliminar el movimiento' }, { status: 500 });
  }
}
