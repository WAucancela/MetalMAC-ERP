/**
 * GET  /api/bancos/cuentas/[id]/movimientos  — lista movimientos de una cuenta
 * POST /api/bancos/cuentas/[id]/movimientos  — registra un movimiento manual
 *                                               (depósito/retiro/ajuste — los
 *                                               de pago/cobro de factura se
 *                                               generan solo desde el RPC)
 */

import { NextResponse } from 'next/server';
import { getAuthenticatedUser, canWrite, puedeGestionarFinanzas } from '@/app/api/_helpers';
import { MovimientoBancarioSchema } from '@/lib/validations/bancos.schema';
import { listarMovimientosBancarios, crearMovimientoBancario } from '@/lib/services/bancos.service';
import { mapMovimientoBancarioRow } from '@/lib/services/mappers';

// Nunca cachear: cada respuesta depende del usuario autenticado y de datos que cambian por request.
export const dynamic = 'force-dynamic';

interface RouteParams { params: { id: string } }

export async function GET(request: Request, { params }: RouteParams) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const movimientos = await listarMovimientosBancarios(params.id);
    return NextResponse.json({ ok: true, data: movimientos.map(mapMovimientoBancarioRow) });
  } catch (e) {
    console.error(`[GET /api/bancos/cuentas/${params.id}/movimientos]`, e);
    return NextResponse.json({ error: 'Error al obtener movimientos' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canWrite(user) && !puedeGestionarFinanzas(user)) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
  }

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const parsed = MovimientoBancarioSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 });

  if (parsed.data.tipo === 'PAGO_PROVEEDOR' || parsed.data.tipo === 'COBRO_CLIENTE') {
    return NextResponse.json(
      { error: 'Los movimientos de pago/cobro de factura se generan automáticamente al registrar el pago/cobro' },
      { status: 400 },
    );
  }

  try {
    const movimiento = await crearMovimientoBancario({
      cuentaBancariaId: params.id,
      tipo: parsed.data.tipo,
      monto: parsed.data.monto,
      fecha: parsed.data.fecha,
      descripcion: parsed.data.descripcion,
      usuarioId: user.uid,
    });
    return NextResponse.json({ ok: true, data: mapMovimientoBancarioRow(movimiento) }, { status: 201 });
  } catch (e) {
    console.error(`[POST /api/bancos/cuentas/${params.id}/movimientos]`, e);
    return NextResponse.json({ error: 'Error al registrar el movimiento' }, { status: 500 });
  }
}
