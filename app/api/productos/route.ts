import { NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { getAuthenticatedUser, canWrite } from '@/app/api/_helpers';
import { ProductoSchema, ProductosQuerySchema } from '@/lib/validations/produccion.schema';

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const qp = ProductosQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!qp.success) return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });

  const { tipo, activo, q: term, limit: pageLimit } = qp.data;

  try {
    let ref = adminDb.collection('productos').orderBy('nombre') as FirebaseFirestore.Query;
    if (tipo)           ref = ref.where('tipo', '==', tipo);
    if (activo !== undefined) ref = ref.where('activo', '==', activo);
    ref = ref.limit(pageLimit);

    const snap = await ref.get();
    let productos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    if (term) {
      const t = term.toLowerCase();
      productos = productos.filter(
        (p: Record<string, unknown>) =>
          String(p.nombre ?? '').toLowerCase().includes(t) ||
          String(p.codigo ?? '').toLowerCase().includes(t),
      );
    }

    return NextResponse.json({ ok: true, data: productos });
  } catch (e) {
    console.error('[GET /api/productos]', e);
    return NextResponse.json({ error: 'Error al obtener productos' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user)           return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const parsed = ProductoSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 });

  try {
    const existing = await adminDb.collection('productos').where('codigo', '==', parsed.data.codigo).limit(1).get();
    if (!existing.empty) return NextResponse.json({ error: `Código ${parsed.data.codigo} ya existe` }, { status: 409 });

    const ref = await adminDb.collection('productos').add({
      ...parsed.data,
      creadoEn: Timestamp.now(),
      creadoPor: user.uid,
    });
    return NextResponse.json({ ok: true, id: ref.id }, { status: 201 });
  } catch (e) {
    console.error('[POST /api/productos]', e);
    return NextResponse.json({ error: 'Error al crear producto' }, { status: 500 });
  }
}
