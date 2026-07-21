/**
 * GET    /api/proveedores/[id]  — detalle de proveedor + últimas facturas
 * PUT    /api/proveedores/[id]  — actualiza proveedor
 * DELETE /api/proveedores/[id]  — soft delete (activo: false)
 */

import { NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { getAuthenticatedUser, canWrite } from '@/app/api/_helpers';
import { ProveedorSchema } from '@/lib/validations/sri.schema';

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const [provSnap, facturasSnap] = await Promise.all([
    adminDb.collection('proveedores').doc(params.id).get(),
    adminDb
      .collection('facturas_compra')
      .where('proveedorId', '==', params.id)
      .orderBy('fechaEmision', 'desc')
      .limit(10)
      .get(),
  ]);

  if (!provSnap.exists) {
    return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });
  }

  const proveedor = { id: provSnap.id, ...provSnap.data() };
  const facturas = facturasSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  return NextResponse.json({ ok: true, data: { proveedor, facturas } });
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ error: 'Sin permiso de escritura' }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const parsed = ProveedorSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 });
  }

  const ref = adminDb.collection('proveedores').doc(params.id);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });

  await ref.update({
    ...parsed.data,
    actualizadoEn: Timestamp.now(),
    actualizadoPor: user.uid,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ error: 'Sin permiso de escritura' }, { status: 403 });

  const ref = adminDb.collection('proveedores').doc(params.id);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });

  await ref.update({ activo: false, actualizadoEn: Timestamp.now() });

  return NextResponse.json({ ok: true });
}
