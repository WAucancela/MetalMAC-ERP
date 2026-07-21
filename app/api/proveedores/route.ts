/**
 * GET  /api/proveedores  — lista proveedores (activos por defecto)
 * POST /api/proveedores  — crea un proveedor
 */

import { NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { getAuthenticatedUser, canWrite } from '@/app/api/_helpers';
import { ProveedorSchema, ProveedoresQuerySchema } from '@/lib/validations/sri.schema';

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const queryParsed = ProveedoresQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!queryParsed.success) {
    return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
  }

  const { activo, q: searchTerm, limit: pageLimit } = queryParsed.data;

  try {
    let ref = adminDb.collection('proveedores').orderBy('razonSocial');

    // Solo filtrar por activo cuando se especifica explícitamente
    if (activo !== undefined) {
      ref = ref.where('activo', '==', activo) as typeof ref;
    }

    ref = ref.limit(pageLimit) as typeof ref;
    const snap = await ref.get();

    let proveedores = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // Filtro por término de búsqueda (Firestore no soporta full-text nativo)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      proveedores = proveedores.filter(
        (p: Record<string, unknown>) =>
          String(p.razonSocial ?? '').toLowerCase().includes(term) ||
          String(p.ruc ?? '').includes(term) ||
          String(p.nombreComercial ?? '').toLowerCase().includes(term),
      );
    }

    return NextResponse.json({ ok: true, data: proveedores });
  } catch (e) {
    console.error('[GET /api/proveedores]', e);
    return NextResponse.json({ error: 'Error al obtener proveedores' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ error: 'Sin permiso de escritura' }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const parsed = ProveedorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 });
  }

  // Verificar RUC único
  try {
    const existing = await adminDb
      .collection('proveedores')
      .where('ruc', '==', parsed.data.ruc)
      .limit(1)
      .get();

    if (!existing.empty) {
      return NextResponse.json(
        { error: `Ya existe un proveedor con el RUC ${parsed.data.ruc}` },
        { status: 409 },
      );
    }

    const docRef = await adminDb.collection('proveedores').add({
      ...parsed.data,
      creadoEn: Timestamp.now(),
      creadoPor: user.uid,
    });

    return NextResponse.json({ ok: true, id: docRef.id }, { status: 201 });
  } catch (e) {
    console.error('[POST /api/proveedores]', e);
    return NextResponse.json({ error: 'Error al crear proveedor' }, { status: 500 });
  }
}
