/**
 * POST /api/cotizaciones/[id]/convertir — el cliente aprobó: crea el Proyecto
 * (mismo RPC crear_proyecto que usa POST /api/proyectos — contador anual PRY-YYYY-NNNN
 * + insert en una sola transacción) y lo vincula de vuelta a la cotización.
 *
 * Solo válido sobre una cotización APROBADA que todavía no se convirtió — no arma
 * órdenes de producción ni factura automáticamente, eso sigue el flujo normal
 * desde el proyecto ya creado (mismo criterio que pedidos_woocommerce, que tampoco
 * salta directo a factura).
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getAuthenticatedUser, canWrite, puedeGestionarFinanzas } from '@/app/api/_helpers';
import { ConvertirCotizacionSchema } from '@/lib/validations/cotizaciones.schema';

// Nunca cachear: cada respuesta depende del usuario autenticado y de datos que cambian por request.
export const dynamic = 'force-dynamic';

interface RouteParams { params: { id: string } }

export async function POST(request: Request, { params }: RouteParams) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canWrite(user) && !puedeGestionarFinanzas(user)) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
  }

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const parsed = ConvertirCotizacionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 });

  try {
    const { data: cotizacion, error: fetchError } = await supabaseAdmin
      .from('cotizaciones')
      .select('id, estado, proyecto_id, cliente_nombre, notas')
      .eq('id', params.id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!cotizacion) return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });
    if (cotizacion.estado !== 'APROBADA') {
      return NextResponse.json({ error: 'Solo se puede convertir una cotización aprobada' }, { status: 409 });
    }
    if (cotizacion.proyecto_id) {
      return NextResponse.json({ error: 'Esta cotización ya fue convertida en un proyecto' }, { status: 409 });
    }

    const { nombre, fechaInicio, presupuesto } = parsed.data;

    const { data: proyecto, error: rpcError } = await supabaseAdmin.rpc('crear_proyecto', {
      p_nombre: nombre,
      p_descripcion: cotizacion.notas || '',
      p_cliente: cotizacion.cliente_nombre,
      p_presupuesto: presupuesto,
      p_costo_estimado: 0,
      p_fecha_inicio: fechaInicio,
      p_responsable_id: user.uid,
      p_usuario_id: user.uid,
    });
    if (rpcError) throw rpcError;

    const { error: updError } = await supabaseAdmin
      .from('cotizaciones')
      .update({ proyecto_id: proyecto.id })
      .eq('id', params.id);
    if (updError) throw updError;

    return NextResponse.json({ ok: true, proyectoId: proyecto.id, proyectoCodigo: proyecto.codigo }, { status: 201 });
  } catch (e) {
    console.error(`[POST /api/cotizaciones/${params.id}/convertir]`, e);
    return NextResponse.json({ error: 'Error al convertir la cotización en proyecto' }, { status: 500 });
  }
}
