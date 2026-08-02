/**
 * GET    /api/contabilidad/facturas/[id]  — obtiene una factura
 * PATCH  /api/contabilidad/facturas/[id]  — actualiza estado (PROCESADA | ANULADA)
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getAuthenticatedUser, canWrite } from '@/app/api/_helpers';
import { mapFacturaCompraRow } from '@/lib/services/mappers';
import { z } from 'zod';

// Nunca cachear: cada respuesta depende del usuario autenticado y de datos que cambian por request.
export const dynamic = 'force-dynamic';

const PatchSchema = z.object({
  estado: z.enum(['PENDIENTE', 'PROCESADA', 'ANULADA']),
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

  const { data: updated, error } = await supabaseAdmin
    .from('facturas_compra')
    .update({ estado: parsed.data.estado })
    .eq('id', params.id)
    .select('id')
    .maybeSingle();
  if (error) return NextResponse.json({ error: 'Error al actualizar factura' }, { status: 500 });
  if (!updated) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });

  return NextResponse.json({ ok: true });
}
