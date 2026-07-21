/**
 * POST /api/inventario/movimientos  → registrar movimiento (usa la función RPC
 *                                      registrar_movimiento_inventario)
 * GET  /api/inventario/movimientos  → listar movimientos con filtros
 */
import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { registrarMovimiento } from '@/lib/services/inventario.service';
import {
  CreateMovimientoSchema,
  MovimientosQuerySchema,
} from '@/lib/validations/inventario.schema';
import {
  ok, created, badRequest, unauthorized, forbidden, notFound,
  fromZodError, internalError, getAuthenticatedUser, canWrite,
  encodeCursor, decodeCursor, cursorFilterAntesDe,
} from '@/app/api/_helpers';
import {
  StockInsuficienteError,
  MaterialNoEncontradoError,
} from '@/types/metalmac.types';
import { mapMovimientoRow } from '@/lib/services/mappers';

// POST — registrar movimiento vía RPC
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
    let query = supabaseAdmin
      .from('movimientos_inventario')
      .select('*')
      .order('fecha', { ascending: false })
      .order('id', { ascending: false });

    if (materialId) query = query.eq('material_id', materialId);
    if (tipo)       query = query.eq('tipo', tipo);
    if (desde)      query = query.gte('fecha', desde.toISOString());
    if (hasta)      query = query.lte('fecha', hasta.toISOString());

    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (decoded) query = query.or(cursorFilterAntesDe('fecha', decoded));
    }

    query = query.limit(limite);

    const { data, error } = await query;
    if (error) throw error;

    const rows = data ?? [];
    const movimientos = rows.map(mapMovimientoRow);

    const last = rows.at(-1);
    const nextCursor =
      rows.length === limite && last
        ? encodeCursor({ valor: last.fecha, id: last.id })
        : undefined;

    return ok({ movimientos, nextCursor });
  } catch (err) {
    console.error('[GET /movimientos]', err);
    return internalError();
  }
}
