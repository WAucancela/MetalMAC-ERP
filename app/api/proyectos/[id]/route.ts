/**
 * GET   /api/proyectos/[id]  — detalle con gastos y OPs vinculadas
 * PUT   /api/proyectos/[id]  — actualización parcial
 * DELETE /api/proyectos/[id] — soft delete → CANCELADO
 */

import { NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { getAuthenticatedUser, canWrite } from '@/app/api/_helpers';
import { ActualizarProyectoSchema } from '@/lib/validations/proyectos.schema';

interface RouteParams { params: { id: string } }

export async function GET(request: Request, { params }: RouteParams) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const [proyectoSnap, gastosSnap] = await Promise.all([
      adminDb.collection('proyectos').doc(params.id).get(),
      adminDb.collection('gastos_proyecto')
        .where('proyectoId', '==', params.id)
        .orderBy('fecha', 'desc')
        .limit(200)
        .get(),
    ]);

    if (!proyectoSnap.exists) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });

    const proyecto = { id: proyectoSnap.id, ...proyectoSnap.data() };
    const gastos   = gastosSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // costoReal = suma de todos los gastos
    const costoReal = gastos.reduce((acc: number, g: any) => acc + (g.monto ?? 0), 0);

    return NextResponse.json({ ok: true, data: { proyecto, gastos, costoReal } });
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
    const ref = adminDb.collection('proyectos').doc(params.id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });

    const updates: Record<string, any> = {
      ...parsed.data,
      actualizadoEn: Timestamp.now(),
      actualizadoPor: user.uid,
    };

    // Convertir fechas string a Timestamp
    if (updates.fechaInicio) updates.fechaInicio = Timestamp.fromDate(new Date(updates.fechaInicio));
    if (updates.fechaFin)    updates.fechaFin    = Timestamp.fromDate(new Date(updates.fechaFin));
    else if ('fechaFin' in parsed.data && parsed.data.fechaFin === null) updates.fechaFin = null;

    await ref.update(updates);
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
    const ref = adminDb.collection('proyectos').doc(params.id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });

    // Soft delete — cambia estado a CANCELADO
    await ref.update({
      estado: 'CANCELADO',
      actualizadoEn: Timestamp.now(),
      actualizadoPor: user.uid,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(`[DELETE /api/proyectos/${params.id}]`, e);
    return NextResponse.json({ error: 'Error al eliminar proyecto' }, { status: 500 });
  }
}
