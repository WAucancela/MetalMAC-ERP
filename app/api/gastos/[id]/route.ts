/**
 * GET    /api/gastos/[id]
 * PUT    /api/gastos/[id]  — actualiza gasto (el trigger recalcula
 *                            proyectos.costo_real automáticamente si aplica)
 * DELETE /api/gastos/[id]  — elimina gasto (el trigger descuenta de costo_real si aplica)
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getAuthenticatedUser, canWrite, puedeGestionarFinanzas } from '@/app/api/_helpers';
import { ActualizarGastoSchema } from '@/lib/validations/proyectos.schema';
import { mapGastoRow } from '@/lib/services/mappers';
import type { Database } from '@/types/supabase.types';

// Nunca cachear: cada respuesta depende del usuario autenticado y de datos que cambian por request.
export const dynamic = 'force-dynamic';

interface RouteParams { params: { id: string } }
type GastoUpdate = Database['public']['Tables']['gastos']['Update'];

export async function GET(request: Request, { params }: RouteParams) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data: gasto, error } = await supabaseAdmin
    .from('gastos')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: 'Error al obtener gasto' }, { status: 500 });
  if (!gasto) return NextResponse.json({ error: 'Gasto no encontrado' }, { status: 404 });

  return NextResponse.json({ ok: true, data: mapGastoRow(gasto) });
}

export async function PUT(request: Request, { params }: RouteParams) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  // Mismo criterio que POST /api/gastos: BODEGUERO conserva el acceso que ya tenía,
  // CONTABILIDAD se suma para lo general/administrativo.
  if (!canWrite(user) && !puedeGestionarFinanzas(user)) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
  }

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const parsed = ActualizarGastoSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 });

  try {
    const update: GastoUpdate = {};
    if (parsed.data.centroCostoId !== undefined) update.centro_costo_id = parsed.data.centroCostoId;
    if (parsed.data.categoria !== undefined)   update.categoria = parsed.data.categoria;
    if (parsed.data.descripcion !== undefined) update.descripcion = parsed.data.descripcion;
    if (parsed.data.monto !== undefined)       update.monto = parsed.data.monto;
    if (parsed.data.fecha !== undefined)       update.fecha = parsed.data.fecha;
    if (parsed.data.proveedorId !== undefined) update.proveedor_id = parsed.data.proveedorId;
    if (parsed.data.facturaId !== undefined)   update.factura_id = parsed.data.facturaId;
    if (parsed.data.ordenId !== undefined)     update.orden_id = parsed.data.ordenId;
    if (parsed.data.comprobante !== undefined) update.comprobante = parsed.data.comprobante;

    // Update plano — si `monto` cambió, el trigger trg_gastos_proyecto_costo_real
    // ajusta proyectos.costo_real con el delta automáticamente (si hay proyecto).
    const { data: updated, error } = await supabaseAdmin
      .from('gastos')
      .update(update)
      .eq('id', params.id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!updated) return NextResponse.json({ error: 'Gasto no encontrado' }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(`[PUT /api/gastos/${params.id}]`, e);
    return NextResponse.json({ error: 'Error al actualizar gasto' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  // Mismo criterio que POST /api/gastos: BODEGUERO conserva el acceso que ya tenía,
  // CONTABILIDAD se suma para lo general/administrativo.
  if (!canWrite(user) && !puedeGestionarFinanzas(user)) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
  }

  try {
    const { data: deleted, error } = await supabaseAdmin
      .from('gastos')
      .delete()
      .eq('id', params.id)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!deleted) return NextResponse.json({ error: 'Gasto no encontrado' }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(`[DELETE /api/gastos/${params.id}]`, e);
    return NextResponse.json({ error: 'Error al eliminar gasto' }, { status: 500 });
  }
}
