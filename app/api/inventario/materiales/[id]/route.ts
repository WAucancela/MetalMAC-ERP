/**
 * GET    /api/inventario/materiales/[id]  → detalle + stock + movimientos recientes
 * PUT    /api/inventario/materiales/[id]  → actualizar material
 * DELETE /api/inventario/materiales/[id]  → desactivar (soft-delete)
 */
import { NextRequest } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { UpdateMaterialSchema } from '@/lib/validations/inventario.schema';
import {
  ok, badRequest, unauthorized, forbidden, notFound,
  fromZodError, internalError, getAuthenticatedUser, canWrite,
} from '@/app/api/_helpers';
import type { Material, Stock, MovimientoInventario } from '@/types/metalmac.types';

type RouteContext = { params: { id: string } };

// GET — detalle
export async function GET(request: NextRequest, { params }: RouteContext) {
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorized();

  try {
    const [materialSnap, stockSnap] = await Promise.all([
      adminDb.collection('materiales').doc(params.id).get(),
      adminDb.collection('stock').doc(params.id).get(),
    ]);

    if (!materialSnap.exists) return notFound('Material no encontrado');

    // Últimos 20 movimientos
    const movSnap = await adminDb
      .collection('movimientos_inventario')
      .where('materialId', '==', params.id)
      .orderBy('fecha', 'desc')
      .limit(20)
      .get();

    return ok({
      material:    { id: materialSnap.id, ...(materialSnap.data() as Omit<Material, 'id'>) },
      stock:       stockSnap.exists ? stockSnap.data() as Stock : null,
      movimientos: movSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<MovimientoInventario, 'id'>),
      })),
    });
  } catch (err) {
    console.error('[GET /materiales/:id]', err);
    return internalError();
  }
}

// PUT — actualizar
export async function PUT(request: NextRequest, { params }: RouteContext) {
  const user = await getAuthenticatedUser(request);
  if (!user)           return unauthorized();
  if (!canWrite(user)) return forbidden();

  const body = await request.json().catch(() => null);
  if (!body) return badRequest('Body inválido');

  const parsed = UpdateMaterialSchema.safeParse(body);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const ref = adminDb.collection('materiales').doc(params.id);
    const snap = await ref.get();
    if (!snap.exists) return notFound('Material no encontrado');

    await ref.update({ ...parsed.data, modificadoEn: Timestamp.now() });
    return ok({ id: params.id, ...parsed.data });
  } catch (err) {
    console.error('[PUT /materiales/:id]', err);
    return internalError();
  }
}

// DELETE — soft delete (activo = false)
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const user = await getAuthenticatedUser(request);
  if (!user)           return unauthorized();
  if (!canWrite(user)) return forbidden();

  try {
    const ref = adminDb.collection('materiales').doc(params.id);
    const snap = await ref.get();
    if (!snap.exists) return notFound('Material no encontrado');

    await ref.update({ activo: false, modificadoEn: Timestamp.now() });
    return ok({ id: params.id, activo: false });
  } catch (err) {
    console.error('[DELETE /materiales/:id]', err);
    return internalError();
  }
}
