/**
 * POST /api/contabilidad/facturas/[id]/devolucion
 *
 * Registra una devolución parcial a proveedor sobre una factura de compra ya
 * PROCESADA: resta stock del material indicado (movimiento DEVOLUCION_PROVEEDOR),
 * sin anular la factura completa ni el resto de sus líneas. Ver
 * facturas-compra.service.ts / registrar_devolucion_proveedor para el detalle
 * de las validaciones (factura debe estar PROCESADA, no se puede devolver más
 * de lo que hay disponible en stock).
 */

import { NextResponse } from 'next/server';
import { getAuthenticatedUser, canWrite } from '@/app/api/_helpers';
import { RegistrarDevolucionSchema } from '@/lib/validations/sri.schema';
import {
  registrarDevolucionProveedor,
  FacturaNoEncontradaError,
  EstadoFacturaInvalidoError,
} from '@/lib/services/facturas-compra.service';
import { StockInsuficienteError, MaterialNoEncontradoError } from '@/types/metalmac.types';

// Nunca cachear: cada respuesta depende del usuario autenticado y de datos que cambian por request.
export const dynamic = 'force-dynamic';

interface RouteParams { params: { id: string } }

export async function POST(request: Request, { params }: RouteParams) {
  const user = await getAuthenticatedUser(request);
  if (!user)           return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ error: 'Sin permiso de escritura' }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const parsed = RegistrarDevolucionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const movimientoId = await registrarDevolucionProveedor({
      facturaId: params.id,
      materialId: parsed.data.materialId,
      cantidad: parsed.data.cantidad,
      usuarioId: user.uid,
    });
    return NextResponse.json({ ok: true, movimientoId }, { status: 201 });
  } catch (e) {
    if (e instanceof FacturaNoEncontradaError) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });
    }
    if (e instanceof EstadoFacturaInvalidoError) {
      return NextResponse.json(
        { error: 'Solo se puede registrar una devolución sobre una factura procesada' },
        { status: 409 },
      );
    }
    if (e instanceof MaterialNoEncontradoError) {
      return NextResponse.json({ error: e.message }, { status: 404 });
    }
    if (e instanceof StockInsuficienteError) {
      return NextResponse.json(
        {
          error: `No hay suficiente stock para devolver (disponible ${e.disponible}, se pidió ${e.solicitado}).`,
          materialId: e.materialId,
          disponible: e.disponible,
          solicitado: e.solicitado,
        },
        { status: 409 },
      );
    }
    console.error(`[POST /api/contabilidad/facturas/${params.id}/devolucion]`, e);
    return NextResponse.json({ error: 'Error al registrar la devolución' }, { status: 500 });
  }
}
