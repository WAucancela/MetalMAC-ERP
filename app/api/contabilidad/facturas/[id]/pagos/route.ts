/**
 * GET  /api/contabilidad/facturas/[id]/pagos  — lista pagos de una factura de compra
 * POST /api/contabilidad/facturas/[id]/pagos  — registra un pago (vía RPC
 *                                                registrar_pago_compra, atómico
 *                                                con el movimiento bancario si aplica)
 */

import { NextResponse } from 'next/server';
import { getAuthenticatedUser, canWrite, puedeGestionarFinanzas } from '@/app/api/_helpers';
import { RegistrarPagoSchema } from '@/lib/validations/finanzas.schema';
import { registrarPagoCompra, listarPagosCompra, SaldoInsuficienteError, FacturaNoEncontradaError } from '@/lib/services/finanzas.service';
import { mapPagoFacturaCompraRow } from '@/lib/services/mappers';

// Nunca cachear: cada respuesta depende del usuario autenticado y de datos que cambian por request.
export const dynamic = 'force-dynamic';

interface RouteParams { params: { id: string } }

export async function GET(request: Request, { params }: RouteParams) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const pagos = await listarPagosCompra(params.id);
    return NextResponse.json({ ok: true, data: pagos.map(mapPagoFacturaCompraRow) });
  } catch (e) {
    console.error(`[GET /api/contabilidad/facturas/${params.id}/pagos]`, e);
    return NextResponse.json({ error: 'Error al obtener pagos' }, { status: 500 });
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

  const parsed = RegistrarPagoSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 });

  try {
    const pago = await registrarPagoCompra(params.id, parsed.data, user.uid);
    return NextResponse.json({ ok: true, data: mapPagoFacturaCompraRow(pago) }, { status: 201 });
  } catch (e) {
    if (e instanceof SaldoInsuficienteError) {
      return NextResponse.json({ error: e.message }, { status: 422 });
    }
    if (e instanceof FacturaNoEncontradaError) {
      return NextResponse.json({ error: e.message }, { status: 404 });
    }
    console.error(`[POST /api/contabilidad/facturas/${params.id}/pagos]`, e);
    return NextResponse.json({ error: 'Error al registrar el pago' }, { status: 500 });
  }
}
