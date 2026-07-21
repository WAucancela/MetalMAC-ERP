/**
 * GET  /api/ordenes-produccion  — lista OPs con filtros
 * POST /api/ordenes-produccion  — crea OP, valida stock, reserva materiales
 */

import { NextResponse } from 'next/server';
import { Timestamp, type Query } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { getAuthenticatedUser, canWrite } from '@/app/api/_helpers';
import { CrearOrdenSchema, OrdenesQuerySchema } from '@/lib/validations/produccion.schema';

/** Genera el siguiente código de OP en una transacción (OP-YYYY-NNNN) */
async function generarCodigoOP(): Promise<string> {
  const year = new Date().getFullYear();
  const counterRef = adminDb.collection('_counters').doc(`op_${year}`);

  const seq = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    const current = snap.exists ? (snap.data()?.seq ?? 0) : 0;
    const next = current + 1;
    tx.set(counterRef, { seq: next, year });
    return next;
  });

  return `OP-${year}-${String(seq).padStart(4, '0')}`;
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const qp = OrdenesQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!qp.success) return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });

  const { estado, productoId, proyectoId, desde, hasta, limit: pageLimit, startAfter: cursorId } = qp.data;

  try {
    let q = adminDb.collection('ordenes_produccion').orderBy('fechaEntrega', 'asc') as Query;
    if (estado)     q = q.where('estado', '==', estado);
    if (productoId) q = q.where('productoId', '==', productoId);
    if (proyectoId) q = q.where('proyectoId', '==', proyectoId);
    if (desde)      q = q.where('fechaEntrega', '>=', Timestamp.fromDate(new Date(desde)));
    if (hasta)      q = q.where('fechaEntrega', '<=', Timestamp.fromDate(new Date(hasta)));

    if (cursorId) {
      const cursor = await adminDb.collection('ordenes_produccion').doc(cursorId).get();
      if (cursor.exists) q = q.startAfter(cursor);
    }

    q = q.limit(pageLimit);
    const snap = await q.get();
    const ordenes = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const nextCursor = snap.docs.length === pageLimit ? snap.docs.at(-1)!.id : null;

    return NextResponse.json({ ok: true, data: ordenes, nextCursor });
  } catch (e) {
    console.error('[GET /api/ordenes-produccion]', e);
    return NextResponse.json({ error: 'Error al obtener órdenes' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user)           return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const parsed = CrearOrdenSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 });

  const { productoId, cantidad, fechaEntrega, proyectoId, notas } = parsed.data;

  try {
    // Verificar que el producto existe
    const prodSnap = await adminDb.collection('productos').doc(productoId).get();
    if (!prodSnap.exists) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });

    // Verificar que tiene BOM
    const bomSnap = await adminDb.collection('bom').doc(productoId).get();
    if (!bomSnap.exists) {
      return NextResponse.json(
        { error: `El producto no tiene BOM configurado. Configúralo en /productos/${productoId}` },
        { status: 422 },
      );
    }

    const codigo = await generarCodigoOP();

    // Crear la OP en BORRADOR — la reserva de materiales se hace por el cliente
    // usando el endpoint PATCH /[id] { estado: 'EN_PROCESO' }
    const ref = await adminDb.collection('ordenes_produccion').add({
      codigo,
      productoId,
      cantidad,
      estado: 'BORRADOR',
      fechaInicio: Timestamp.now(),
      fechaEntrega: Timestamp.fromDate(new Date(fechaEntrega)),
      costoEstimado: 0,   // se calcula al pasar a EN_PROCESO
      costoReal: null,
      proyectoId: proyectoId ?? null,
      notas,
      materialesReservados: [],
      creadoEn: Timestamp.now(),
      creadoPor: user.uid,
    });

    return NextResponse.json({ ok: true, id: ref.id, codigo }, { status: 201 });
  } catch (e) {
    console.error('[POST /api/ordenes-produccion]', e);
    return NextResponse.json({ error: 'Error al crear orden de producción' }, { status: 500 });
  }
}
