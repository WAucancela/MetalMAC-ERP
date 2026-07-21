/**
 * GET    /api/gastos-proyecto/[id]
 * PUT    /api/gastos-proyecto/[id]  — actualiza gasto y recalcula costoReal del proyecto
 * DELETE /api/gastos-proyecto/[id]  — elimina gasto y descuenta de costoReal
 */

import { NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { getAuthenticatedUser, canWrite } from '@/app/api/_helpers';
import { ActualizarGastoSchema } from '@/lib/validations/proyectos.schema';
import Decimal from 'decimal.js';

interface RouteParams { params: { id: string } }

export async function GET(request: Request, { params }: RouteParams) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const snap = await adminDb.collection('gastos_proyecto').doc(params.id).get();
  if (!snap.exists) return NextResponse.json({ error: 'Gasto no encontrado' }, { status: 404 });

  return NextResponse.json({ ok: true, data: { id: snap.id, ...snap.data() } });
}

export async function PUT(request: Request, { params }: RouteParams) {
  const user = await getAuthenticatedUser(request);
  if (!user)           return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const parsed = ActualizarGastoSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 });

  try {
    const gastoRef = adminDb.collection('gastos_proyecto').doc(params.id);
    const gastoSnap = await gastoRef.get();
    if (!gastoSnap.exists) return NextResponse.json({ error: 'Gasto no encontrado' }, { status: 404 });

    const gastoActual = gastoSnap.data()!;
    const montoAnterior = gastoActual.monto as number;
    const nuevoMonto    = parsed.data.monto ?? montoAnterior;
    const diferencia    = new Decimal(nuevoMonto).minus(montoAnterior).toNumber();

    await adminDb.runTransaction(async (tx) => {
      // Actualizar el gasto
      const updates: Record<string, any> = { ...parsed.data };
      if (updates.fecha) updates.fecha = Timestamp.fromDate(new Date(updates.fecha));
      tx.update(gastoRef, updates);

      // Actualizar costoReal del proyecto si cambió el monto
      if (diferencia !== 0) {
        const proyectoRef  = adminDb.collection('proyectos').doc(gastoActual.proyectoId);
        const proyectoSnap = await tx.get(proyectoRef);
        if (proyectoSnap.exists) {
          const costoActual = new Decimal(proyectoSnap.data()!.costoReal ?? 0);
          tx.update(proyectoRef, {
            costoReal: costoActual.plus(diferencia).toDecimalPlaces(2).toNumber(),
            actualizadoEn: Timestamp.now(),
            actualizadoPor: user.uid,
          });
        }
      }
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(`[PUT /api/gastos-proyecto/${params.id}]`, e);
    return NextResponse.json({ error: 'Error al actualizar gasto' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const user = await getAuthenticatedUser(request);
  if (!user)           return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  try {
    const gastoRef  = adminDb.collection('gastos_proyecto').doc(params.id);
    const gastoSnap = await gastoRef.get();
    if (!gastoSnap.exists) return NextResponse.json({ error: 'Gasto no encontrado' }, { status: 404 });

    const { proyectoId, monto } = gastoSnap.data()!;

    await adminDb.runTransaction(async (tx) => {
      tx.delete(gastoRef);

      // Descontar del costoReal del proyecto
      const proyectoRef  = adminDb.collection('proyectos').doc(proyectoId);
      const proyectoSnap = await tx.get(proyectoRef);
      if (proyectoSnap.exists) {
        const costoActual = new Decimal(proyectoSnap.data()!.costoReal ?? 0);
        const nuevoCosto  = Decimal.max(0, costoActual.minus(monto)).toDecimalPlaces(2).toNumber();
        tx.update(proyectoRef, {
          costoReal: nuevoCosto,
          actualizadoEn: Timestamp.now(),
          actualizadoPor: user.uid,
        });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(`[DELETE /api/gastos-proyecto/${params.id}]`, e);
    return NextResponse.json({ error: 'Error al eliminar gasto' }, { status: 500 });
  }
}
