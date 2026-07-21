/**
 * GET /api/unidades-medida — lista todas las unidades (solo lectura, todos los roles)
 */

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getAuthenticatedUser } from '@/app/api/_helpers';

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const snap = await adminDb.collection('unidades_medida').orderBy('nombre').get();
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    console.error('[GET /api/unidades-medida]', e);
    return NextResponse.json({ error: 'Error al obtener unidades' }, { status: 500 });
  }
}
