/**
 * GET  /api/proyectos  — lista proyectos con filtros
 * POST /api/proyectos  — crea proyecto (solo GERENTE)
 */

import { NextResponse } from 'next/server';
import { Timestamp, type Query } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { getAuthenticatedUser, canWrite } from '@/app/api/_helpers';
import { ProyectoSchema, ProyectosQuerySchema } from '@/lib/validations/proyectos.schema';

async function generarCodigoProyecto(): Promise<string> {
  const year = new Date().getFullYear();
  const counterRef = adminDb.collection('_counters').doc(`pry_${year}`);
  const seq = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    const next = (snap.exists ? (snap.data()?.seq ?? 0) : 0) + 1;
    tx.set(counterRef, { seq: next, year });
    return next;
  });
  return `PRY-${year}-${String(seq).padStart(4, '0')}`;
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const qp = ProyectosQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!qp.success) return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });

  const { estado, cliente, limit: pageLimit, startAfter: cursorId } = qp.data;

  try {
    let q = adminDb.collection('proyectos').orderBy('fechaInicio', 'desc') as Query;
    if (estado) q = q.where('estado', '==', estado);

    if (cursorId) {
      const cursor = await adminDb.collection('proyectos').doc(cursorId).get();
      if (cursor.exists) q = q.startAfter(cursor);
    }
    q = q.limit(pageLimit);

    const snap = await q.get();
    let proyectos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // Filtro por cliente en memoria (no es campo indexado)
    if (cliente) {
      const cl = cliente.toLowerCase();
      proyectos = proyectos.filter((p: any) =>
        p.cliente?.toLowerCase().includes(cl),
      );
    }

    const nextCursor = snap.docs.length === pageLimit ? snap.docs.at(-1)!.id : null;
    return NextResponse.json({ ok: true, data: proyectos, nextCursor });
  } catch (e) {
    console.error('[GET /api/proyectos]', e);
    return NextResponse.json({ error: 'Error al obtener proyectos' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user)           return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const parsed = ProyectoSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 });

  const { nombre, descripcion, cliente, presupuesto, estado, fechaInicio, fechaFin, ordenesProduccion } = parsed.data;

  try {
    const codigo = await generarCodigoProyecto();

    const ref = await adminDb.collection('proyectos').add({
      codigo,
      nombre,
      descripcion,
      cliente,
      presupuesto,
      costoEstimado: 0,
      costoReal: 0,
      estado,
      fechaInicio: Timestamp.fromDate(new Date(fechaInicio)),
      fechaFin: fechaFin ? Timestamp.fromDate(new Date(fechaFin)) : null,
      responsableId: user.uid,
      ordenesProduccion,
      creadoEn: Timestamp.now(),
      creadoPor: user.uid,
      actualizadoEn: Timestamp.now(),
      actualizadoPor: user.uid,
    });

    return NextResponse.json({ ok: true, id: ref.id, codigo }, { status: 201 });
  } catch (e) {
    console.error('[POST /api/proyectos]', e);
    return NextResponse.json({ error: 'Error al crear proyecto' }, { status: 500 });
  }
}
