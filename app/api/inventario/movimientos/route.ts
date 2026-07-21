/**
 * POST /api/inventario/movimientos  → registrar movimiento (usa Firestore Transaction)
 * GET  /api/inventario/movimientos  → listar movimientos con filtros
 */
import { NextRequest } from 'next/server';
import { Timestamp, type Query } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { registrarMovimiento } from '@/lib/services/inventario.service';
import {
  CreateMovimientoSchema,
  MovimientosQuerySchema,
} from '@/lib/validations/inventario.schema';
import {
  ok, created, badRequest, unauthorized, forbidden, notFound,
  fromZodError, internalError, getAuthenticatedUser, canWrite,
} from '@/app/api/_helpers';
import {
  StockInsuficienteError,
  MaterialNoEncontradoError,
} from '@/types/metalmac.types';
import type { MovimientoInventario } from '@/types/metalmac.types';

// POST — registrar movimiento con Transaction
export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user)           return unauthorized();
  if (!canWrite(user)) return forbidden('Solo GERENTE o BODEGUERO pueden registrar movimientos');

  const body = await request.json().catch(() => null);
  if (!body) return badRequest('Body inválido');

  const parsed = CreateMovimientoSchema.safeParse(body);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const id = await registrarMovimiento({
      ...parsed.data,
      usuarioId: user.uid, // inyectado server-side, nunca del cliente
    });
    return created({ id });
  } catch (err) {
    if (err instanceof MaterialNoEncontradoError) return notFound(err.message);
    if (err instanceof StockInsuficienteError) {
      return badRequest(err.message, {
        disponible: err.disponible,
        solicitado: err.solicitado,
      });
    }
    console.error('[POST /movimientos]', err);
    return internalError();
  }
}

// GET — historial de movimientos con filtros opcionales
export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorized();

  const parsed = MovimientosQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!parsed.success) return fromZodError(parsed.error);

  const { materialId, tipo, desde, hasta, limite, cursor } = parsed.data;

  try {
    let ref = adminDb
      .collection('movimientos_inventario')
      .orderBy('fecha', 'desc') as Query;

    if (materialId) ref = ref.where('materialId', '==', materialId);
    if (tipo)       ref = ref.where('tipo', '==', tipo);
    if (desde)      ref = ref.where('fecha', '>=', Timestamp.fromDate(desde));
    if (hasta)      ref = ref.where('fecha', '<=', Timestamp.fromDate(hasta));

    ref = ref.limit(limite);

    if (cursor) {
      const cursorDoc = await adminDb.collection('movimientos_inventario').doc(cursor).get();
      if (cursorDoc.exists) ref = ref.startAfter(cursorDoc);
    }

    const snap = await ref.get();
    const movimientos = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<MovimientoInventario, 'id'>),
    }));

    const nextCursor =
      snap.docs.length === limite
        ? snap.docs.at(-1)?.id
        : undefined;

    return ok({ movimientos, nextCursor });
  } catch (err) {
    console.error('[GET /movimientos]', err);
    return internalError();
  }
}
