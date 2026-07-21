/**
 * GET    /api/contabilidad/facturas/[id]  — obtiene una factura
 * PATCH  /api/contabilidad/facturas/[id]  — actualiza estado (PROCESADA | ANULADA)
 */

import { NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { getAuthenticatedUser, canWrite } from '@/app/api/_helpers';
import { z } from 'zod';

const PatchSchema = z.object({
  estado: z.enum(['PENDIENTE', 'PROCESADA', 'ANULADA']),
});

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getAuthenticatedUser(_request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const snap = await adminDb.collection('facturas_compra').doc(params.id).get();
  if (!snap.exists) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });

  return NextResponse.json({ ok: true, data: { id: snap.id, ...snap.data() } });
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ error: 'Sin permiso de escritura' }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 });
  }

  const ref = adminDb.collection('facturas_compra').doc(params.id);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });

  await ref.update({
    estado: parsed.data.estado,
    actualizadoEn: Timestamp.now(),
    actualizadoPor: user.uid,
  });

  return NextResponse.json({ ok: true });
}
