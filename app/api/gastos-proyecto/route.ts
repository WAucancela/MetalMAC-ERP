/**
 * GET  /api/gastos-proyecto  — lista gastos con filtros
 * POST /api/gastos-proyecto  — registra gasto y actualiza costoReal del proyecto
 */

import { NextResponse } from 'next/server';
import { Timestamp, type Query } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { getAuthenticatedUser, canWrite } from '@/app/api/_helpers';
import { GastoSchema, GastosQuerySchema } from '@/lib/validations/proyectos.schema';
import Decimal from 'decimal.js';

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const qp = GastosQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!qp.success) return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });

  const { proyectoId, categoria, desde, hasta, limit: pageLimit, startAfter: cursorId } = qp.data;

  try {
    let q = adminDb.collection('gastos_proyecto').orderBy('fecha', 'desc') as Query;
    if (proyectoId) q = q.where('proyectoId', '==', proyectoId);
    if (categoria)  q = q.where('categoria',  '==', categoria);
    if (desde)      q = q.where('fecha', '>=', Timestamp.fromDate(new Date(desde)));
    if (hasta)      q = q.where('fecha', '<=', Timestamp.fromDate(new Date(hasta)));

    if (cursorId) {
      const cursor = await adminDb.collection('gastos_proyecto').doc(cursorId).get();
      if (cursor.exists) q = q.startAfter(cursor);
    }
    q = q.limit(pageLimit);

    const snap = await q.get();
    const gastos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const nextCursor = snap.docs.length === pageLimit ? snap.docs.at(-1)!.id : null;

    return NextResponse.json({ ok: true, data: gastos, nextCursor });
  } catch (e) {
    console.error('[GET /api/gastos-proyecto]', e);
    return NextResponse.json({ error: 'Error al obtener gastos' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user)           return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const parsed = GastoSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 });

  const { proyectoId, categoria, descripcion, monto, fecha, proveedorId, facturaId, ordenId, comprobante } = parsed.data;

  try {
    // Verificar que el proyecto existe
    const proyectoRef = adminDb.collection('proyectos').doc(proyectoId);
    const proyectoSnap = await proyectoRef.get();
    if (!proyectoSnap.exists) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });

    // Registrar gasto y actualizar costoReal en transacción
    let gastoId: string;

    await adminDb.runTransaction(async (tx) => {
      // Crear el gasto
      const gastoRef = adminDb.collection('gastos_proyecto').doc();
      gastoId = gastoRef.id;

      tx.set(gastoRef, {
        proyectoId,
        categoria,
        descripcion,
        monto,
        fecha: Timestamp.fromDate(new Date(fecha)),
        proveedorId:  proveedorId  ?? null,
        facturaId:    facturaId    ?? null,
        ordenId:      ordenId      ?? null,
        comprobante:  comprobante  ?? null,
        creadoEn:     Timestamp.now(),
        creadoPor:    user.uid,
      });

      // Actualizar costoReal del proyecto
      const proyectoData = proyectoSnap.data()!;
      const costoActual  = new Decimal(proyectoData.costoReal ?? 0);
      const nuevoCosto   = costoActual.plus(monto).toDecimalPlaces(2).toNumber();

      tx.update(proyectoRef, {
        costoReal: nuevoCosto,
        actualizadoEn: Timestamp.now(),
        actualizadoPor: user.uid,
      });
    });

    return NextResponse.json({ ok: true, id: gastoId! }, { status: 201 });
  } catch (e) {
    console.error('[POST /api/gastos-proyecto]', e);
    return NextResponse.json({ error: 'Error al registrar gasto' }, { status: 500 });
  }
}
