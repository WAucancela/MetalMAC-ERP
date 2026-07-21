/**
 * GET  /api/inventario/materiales   → lista paginada de materiales
 * POST /api/inventario/materiales   → crear material
 */
import { NextRequest } from 'next/server';
import { Timestamp, type Query } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import {
  CreateMaterialSchema,
  MaterialesQuerySchema,
} from '@/lib/validations/inventario.schema';
import {
  ok, created, badRequest, unauthorized, forbidden,
  fromZodError, internalError, getAuthenticatedUser, canWrite,
} from '@/app/api/_helpers';
import type { Material, Stock } from '@/types/metalmac.types';

// GET — lista materiales + stock actual
export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorized();

  const parsed = MaterialesQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!parsed.success) return fromZodError(parsed.error);

  const { tipo, activo, q, limite } = parsed.data;

  try {
    let ref = adminDb.collection('materiales').orderBy('nombre') as Query;
    if (tipo)   ref = ref.where('tipo', '==', tipo);
    if (activo !== undefined) ref = ref.where('activo', '==', activo);
    ref = ref.limit(limite);

    const [materialesSnap, stockSnap] = await Promise.all([
      ref.get(),
      adminDb.collection('stock').get(),
    ]);

    const stockMap = new Map(
      stockSnap.docs.map((d) => [d.id, d.data() as Omit<Stock, 'materialId'>]),
    );

    let materiales = materialesSnap.docs.map((d) => ({
      ...(d.data() as Omit<Material, 'id'>),
      id:    d.id,
      stock: stockMap.get(d.id) ?? null,
    }));

    // Filtro por texto en memoria (Firestore no soporta LIKE nativo)
    if (q) {
      const term = q.toLowerCase();
      materiales = materiales.filter(
        (m) =>
          m.nombre.toLowerCase().includes(term) ||
          m.codigoInterno.toLowerCase().includes(term),
      );
    }

    return ok(materiales);
  } catch (err) {
    console.error('[GET /materiales]', err);
    return internalError();
  }
}

// POST — crear material
export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user)           return unauthorized();
  if (!canWrite(user)) return forbidden('Solo GERENTE o BODEGUERO pueden crear materiales');

  const body = await request.json().catch(() => null);
  if (!body) return badRequest('Body inválido o vacío');

  const parsed = CreateMaterialSchema.safeParse(body);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const now = Timestamp.now();
    const data = {
      ...parsed.data,
      creadoEn:     now,
      modificadoEn: now,
    };

    const docRef = await adminDb.collection('materiales').add(data);

    // Crear documento de stock en 0
    await adminDb.collection('stock').doc(docRef.id).set({
      materialId:         docRef.id,
      cantidadDisponible: 0,
      cantidadReservada:  0,
      cantidadMinima:     0,
      cantidadMaxima:     null,
      ubicacion:          '',
      actualizadoEn:      now,
    });

    return created({ id: docRef.id, ...data });
  } catch (err) {
    console.error('[POST /materiales]', err);
    return internalError();
  }
}
