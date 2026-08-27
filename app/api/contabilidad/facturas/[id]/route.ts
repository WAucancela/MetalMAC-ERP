/**
 * GET    /api/contabilidad/facturas/[id]  — obtiene una factura
 * PATCH  /api/contabilidad/facturas/[id]  — actualiza estado (PROCESADA | ANULADA)
 *
 * PROCESADA y ANULADA pasan por facturas-compra.service.ts: además de cambiar
 * el estado, mueven stock (genera entradas al procesar, las revierte al
 * anular una factura ya procesada) — ver esa función para el detalle.
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getAuthenticatedUser, canWrite } from '@/app/api/_helpers';
import { mapFacturaCompraRow } from '@/lib/services/mappers';
import {
  procesarFacturaCompra,
  anularFacturaCompra,
  FacturaNoEncontradaError,
  EstadoFacturaInvalidoError,
  FacturaYaAnuladaError,
} from '@/lib/services/facturas-compra.service';
import { StockInsuficienteError, MaterialNoEncontradoError } from '@/types/metalmac.types';
import { z } from 'zod';

// Nunca cachear: cada respuesta depende del usuario autenticado y de datos que cambian por request.
export const dynamic = 'force-dynamic';

// Sin 'PENDIENTE': nada legítimo en la UI vuelve una factura a Pendiente, y
// permitirlo era una puerta trasera para saltarse procesarFacturaCompra /
// anularFacturaCompra — una factura PROCESADA podía bajarse a PENDIENTE sin
// revertir el stock que ya había entrado, y volver a PROCESADA duplicaba esa
// entrada la segunda vez.
const PatchSchema = z.object({
  estado: z.enum(['PROCESADA', 'ANULADA']),
});

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data: factura, error } = await supabaseAdmin
    .from('facturas_compra')
    .select('*, factura_compra_lineas(*), factura_compra_retenciones(*)')
    .eq('id', params.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: 'Error al obtener factura' }, { status: 500 });
  if (!factura) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });

  return NextResponse.json({
    ok: true,
    data: mapFacturaCompraRow(factura, factura.factura_compra_lineas, factura.factura_compra_retenciones),
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ error: 'Sin permiso de escritura' }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 });
  }

  try {
    if (parsed.data.estado === 'PROCESADA') {
      await procesarFacturaCompra(params.id, user.uid);
    } else {
      await anularFacturaCompra(params.id, user.uid);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof FacturaNoEncontradaError) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });
    }
    if (e instanceof FacturaYaAnuladaError) {
      return NextResponse.json({ error: 'La factura ya está anulada' }, { status: 409 });
    }
    if (e instanceof EstadoFacturaInvalidoError) {
      return NextResponse.json(
        { error: `No se puede pasar de ${e.estadoActual} a este estado` },
        { status: 409 },
      );
    }
    if (e instanceof MaterialNoEncontradoError) {
      return NextResponse.json({ error: e.message }, { status: 404 });
    }
    if (e instanceof StockInsuficienteError) {
      return NextResponse.json(
        {
          error:
            `No se puede anular: falta stock de un material ya consumido ` +
            `(disponible ${e.disponible}, se necesitan ${e.solicitado} para revertir la entrada).`,
          materialId: e.materialId,
          disponible: e.disponible,
          solicitado: e.solicitado,
        },
        { status: 409 },
      );
    }
    console.error(`[PATCH /api/contabilidad/facturas/${params.id}]`, e);
    return NextResponse.json({ error: 'Error al actualizar factura' }, { status: 500 });
  }
}
