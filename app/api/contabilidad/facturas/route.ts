/**
 * GET  /api/contabilidad/facturas  — lista con filtros y paginación
 * POST /api/contabilidad/facturas  — crea una factura de compra
 */

import { NextResponse } from 'next/server';
import { Timestamp, type Query } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { getAuthenticatedUser, canWrite } from '@/app/api/_helpers';
import { FacturaCompraSchema, FacturasQuerySchema } from '@/lib/validations/sri.schema';

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const queryParsed = FacturasQuerySchema.safeParse(Object.fromEntries(searchParams));

  if (!queryParsed.success) {
    return NextResponse.json(
      { error: 'Parámetros inválidos', detalles: queryParsed.error.flatten() },
      { status: 400 },
    );
  }

  const { proveedorId, estado, desde, hasta, limit: pageLimit, startAfter: cursorId } = queryParsed.data;

  try {
    // Admin SDK usa API de encadenamiento (no funcional como el Client SDK)
    let q = adminDb
      .collection('facturas_compra')
      .orderBy('fechaEmision', 'desc') as Query;

    if (proveedorId) q = q.where('proveedorId', '==', proveedorId);
    if (estado)      q = q.where('estado', '==', estado);
    if (desde)       q = q.where('fechaEmision', '>=', Timestamp.fromDate(new Date(desde)));
    if (hasta)       q = q.where('fechaEmision', '<=', Timestamp.fromDate(new Date(hasta)));

    if (cursorId) {
      const cursorDoc = await adminDb.collection('facturas_compra').doc(cursorId).get();
      if (cursorDoc.exists) q = q.startAfter(cursorDoc);
    }

    q = q.limit(pageLimit);

    const snap = await q.get();
    const facturas = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const nextCursor = snap.docs.length === pageLimit
      ? snap.docs[snap.docs.length - 1].id
      : null;

    return NextResponse.json({ ok: true, data: facturas, nextCursor });
  } catch (e) {
    console.error('[GET /api/contabilidad/facturas]', e);
    return NextResponse.json({ error: 'Error al obtener facturas' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user)         return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ error: 'Sin permiso de escritura' }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const parsed = FacturaCompraSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', detalles: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = parsed.data;

  try {
    // Verificar clave de acceso duplicada
    const existing = await adminDb
      .collection('facturas_compra')
      .where('claveAcceso', '==', data.claveAcceso)
      .limit(1)
      .get();

    if (!existing.empty) {
      return NextResponse.json(
        { error: `Ya existe una factura con la clave de acceso ${data.claveAcceso}` },
        { status: 409 },
      );
    }

    const fechaEmision = Timestamp.fromDate(new Date(data.fechaEmision));

    const docRef = await adminDb.collection('facturas_compra').add({
      ...data,
      fechaEmision,
      creadoEn:   Timestamp.now(),
      creadoPor:  user.uid,
    });

    return NextResponse.json({ ok: true, id: docRef.id }, { status: 201 });
  } catch (e) {
    console.error('[POST /api/contabilidad/facturas]', e);
    return NextResponse.json({ error: 'Error al crear factura' }, { status: 500 });
  }
}
