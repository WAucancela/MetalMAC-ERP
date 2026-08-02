/**
 * GET  /api/caja-chica  — lista movimientos de caja chica (con filtros de fecha)
 * POST /api/caja-chica  — registra un movimiento (INGRESO/EGRESO)
 */

import { NextResponse } from 'next/server';
import { getAuthenticatedUser, canWrite, puedeGestionarFinanzas } from '@/app/api/_helpers';
import { CajaMovimientoSchema, CajaMovimientosQuerySchema } from '@/lib/validations/caja.schema';
import { listarMovimientosCaja, crearMovimientoCaja } from '@/lib/services/caja.service';
import { mapCajaMovimientoRow } from '@/lib/services/mappers';

// Nunca cachear: cada respuesta depende del usuario autenticado y de datos que cambian por request.
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const qp = CajaMovimientosQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!qp.success) return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });

  try {
    const movimientos = await listarMovimientosCaja(qp.data);
    return NextResponse.json({ ok: true, data: movimientos.map(mapCajaMovimientoRow) });
  } catch (e) {
    console.error('[GET /api/caja-chica]', e);
    return NextResponse.json({ error: 'Error al obtener movimientos de caja' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canWrite(user) && !puedeGestionarFinanzas(user)) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
  }

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const parsed = CajaMovimientoSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 });

  try {
    const movimiento = await crearMovimientoCaja({
      tipo: parsed.data.tipo,
      monto: parsed.data.monto,
      fecha: parsed.data.fecha,
      concepto: parsed.data.concepto,
      centroCostoId: parsed.data.centroCostoId,
      usuarioId: user.uid,
    });
    return NextResponse.json({ ok: true, data: mapCajaMovimientoRow(movimiento) }, { status: 201 });
  } catch (e) {
    console.error('[POST /api/caja-chica]', e);
    return NextResponse.json({ error: 'Error al registrar el movimiento' }, { status: 500 });
  }
}
