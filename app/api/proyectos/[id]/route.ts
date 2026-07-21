/**
 * GET   /api/proyectos/[id]  — detalle con gastos y OPs vinculadas
 * PUT   /api/proyectos/[id]  — actualización parcial
 * DELETE /api/proyectos/[id] — soft delete → CANCELADO
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getAuthenticatedUser, canWrite } from '@/app/api/_helpers';
import { ActualizarProyectoSchema } from '@/lib/validations/proyectos.schema';
import { mapProyectoRow, mapGastoProyectoRow } from '@/lib/services/mappers';
import type { Database } from '@/types/supabase.types';

interface RouteParams { params: { id: string } }
type ProyectoUpdate = Database['public']['Tables']['proyectos']['Update'];

export async function GET(request: Request, { params }: RouteParams) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const [{ data: proyecto, error: proyectoError }, { data: gastos, error: gastosError }, { data: ordenes, error: ordenesError }] =
      await Promise.all([
        supabaseAdmin.from('proyectos').select('*').eq('id', params.id).maybeSingle(),
        supabaseAdmin.from('gastos_proyecto').select('*').eq('proyecto_id', params.id).order('fecha', { ascending: false }).limit(200),
        supabaseAdmin.from('ordenes_produccion').select('id').eq('proyecto_id', params.id),
      ]);
    if (proyectoError) throw proyectoError;
    if (gastosError) throw gastosError;
    if (ordenesError) throw ordenesError;
    if (!proyecto) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });

    return NextResponse.json({
      ok: true,
      data: {
        proyecto: mapProyectoRow(proyecto),
        gastos: (gastos ?? []).map(mapGastoProyectoRow),
        // costoReal ya no se re-suma en memoria: proyecto.costo_real lo mantiene
        // el trigger sobre gastos_proyecto (fuente de verdad única, ver Fase 1).
        costoReal: Number(proyecto.costo_real),
        ordenesProduccion: (ordenes ?? []).map((o) => o.id),
      },
    });
  } catch (e) {
    console.error(`[GET /api/proyectos/${params.id}]`, e);
    return NextResponse.json({ error: 'Error al obtener proyecto' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  const user = await getAuthenticatedUser(request);
  if (!user)           return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const parsed = ActualizarProyectoSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 });

  try {
    const update: ProyectoUpdate = {
      actualizado_en: new Date().toISOString(),
      actualizado_por: user.uid,
    };
    if (parsed.data.nombre !== undefined)       update.nombre = parsed.data.nombre;
    if (parsed.data.descripcion !== undefined)  update.descripcion = parsed.data.descripcion;
    if (parsed.data.cliente !== undefined)      update.cliente = parsed.data.cliente;
    if (parsed.data.presupuesto !== undefined)  update.presupuesto = parsed.data.presupuesto;
    if (parsed.data.estado !== undefined)       update.estado = parsed.data.estado;
    if (parsed.data.fechaInicio !== undefined)  update.fecha_inicio = parsed.data.fechaInicio;
    if ('fechaFin' in parsed.data)               update.fecha_fin = parsed.data.fechaFin ?? null;

    const { data: updated, error } = await supabaseAdmin
      .from('proyectos')
      .update(update)
      .eq('id', params.id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!updated) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(`[PUT /api/proyectos/${params.id}]`, e);
    return NextResponse.json({ error: 'Error al actualizar proyecto' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const user = await getAuthenticatedUser(request);
  if (!user)           return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  try {
    const { data: updated, error } = await supabaseAdmin
      .from('proyectos')
      .update({
        estado: 'CANCELADO',
        actualizado_en: new Date().toISOString(),
        actualizado_por: user.uid,
      })
      .eq('id', params.id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!updated) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(`[DELETE /api/proyectos/${params.id}]`, e);
    return NextResponse.json({ error: 'Error al eliminar proyecto' }, { status: 500 });
  }
}
