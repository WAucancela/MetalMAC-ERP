/**
 * PATCH /api/contabilidad/facturas/[id]/lineas/[lineaId]/mapear
 *
 * Resuelve manualmente una línea de factura de compra que quedó "sin resolver"
 * (el código del proveedor no tenía equivalencia registrada al momento de subir
 * el XML). Dos efectos:
 *   1. Fija material_id/cantidad_convertida en la línea.
 *   2. Guarda la equivalencia (tabla_equivalencias) para que la próxima factura
 *      de este proveedor con el mismo código se resuelva sola — mismo criterio
 *      que ya usa equivalencias.service.ts al resolver automáticamente.
 */

import { NextResponse } from 'next/server';
import Decimal from 'decimal.js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getAuthenticatedUser, canWrite } from '@/app/api/_helpers';
import { MapearLineaFacturaSchema } from '@/lib/validations/sri.schema';

// Nunca cachear: cada respuesta depende del usuario autenticado y de datos que cambian por request.
export const dynamic = 'force-dynamic';

interface RouteParams { params: { id: string; lineaId: string } }

export async function PATCH(request: Request, { params }: RouteParams) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ error: 'Sin permiso de escritura' }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const parsed = MapearLineaFacturaSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 });

  try {
    const { data: linea, error: lineaError } = await supabaseAdmin
      .from('factura_compra_lineas')
      .select('*')
      .eq('id', params.lineaId)
      .eq('factura_id', params.id)
      .maybeSingle();
    if (lineaError) throw lineaError;
    if (!linea) return NextResponse.json({ error: 'Línea no encontrada' }, { status: 404 });

    const { data: factura, error: facturaError } = await supabaseAdmin
      .from('facturas_compra')
      .select('proveedor_id')
      .eq('id', params.id)
      .maybeSingle();
    if (facturaError) throw facturaError;
    if (!factura) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });

    const { materialId, unidadProveedorId, factorConversion } = parsed.data;
    const cantidadConvertida = new Decimal(linea.cantidad).times(factorConversion).toDecimalPlaces(6).toNumber();

    const { error: updError } = await supabaseAdmin
      .from('factura_compra_lineas')
      .update({ material_id: materialId, cantidad_convertida: cantidadConvertida })
      .eq('id', params.lineaId);
    if (updError) throw updError;

    // Upsert: si ya existía una equivalencia con este código para este proveedor
    // (por ejemplo, una anterior desactivada o con otro material), la reemplaza.
    const codigoProveedor = linea.codigo_proveedor || linea.descripcion.slice(0, 100);
    const { error: eqError } = await supabaseAdmin
      .from('tabla_equivalencias')
      .upsert(
        {
          proveedor_id: factura.proveedor_id,
          codigo_proveedor: codigoProveedor,
          descripcion_proveedor: linea.descripcion,
          material_id: materialId,
          unidad_proveedor_id: unidadProveedorId,
          factor_conversion: factorConversion,
          precio_referencia: linea.precio_unitario,
          activo: true,
        },
        { onConflict: 'proveedor_id,codigo_proveedor' },
      );
    if (eqError) throw eqError;

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(`[PATCH /api/contabilidad/facturas/${params.id}/lineas/${params.lineaId}/mapear]`, e);
    return NextResponse.json({ error: 'Error al mapear la línea' }, { status: 500 });
  }
}
