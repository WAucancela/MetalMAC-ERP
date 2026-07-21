/**
 * GET  /api/ordenes-produccion  — lista OPs con filtros
 * POST /api/ordenes-produccion  — crea OP (contador + insert atómico vía RPC)
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  getAuthenticatedUser, canWrite, encodeCursor, decodeCursor, cursorFilterDespuesDe,
} from '@/app/api/_helpers';
import { CrearOrdenSchema, OrdenesQuerySchema } from '@/lib/validations/produccion.schema';
import { mapOrdenProduccionRow } from '@/lib/services/mappers';

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const qp = OrdenesQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!qp.success) return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });

  const { estado, productoId, proyectoId, desde, hasta, limit: pageLimit, startAfter: cursor } = qp.data;

  try {
    let query = supabaseAdmin
      .from('ordenes_produccion')
      .select('*, orden_materiales_reservados(*)')
      .order('fecha_entrega', { ascending: true })
      .order('id', { ascending: true });

    if (estado)     query = query.eq('estado', estado);
    if (productoId) query = query.eq('producto_id', productoId);
    if (proyectoId) query = query.eq('proyecto_id', proyectoId);
    if (desde)      query = query.gte('fecha_entrega', desde);
    if (hasta)      query = query.lte('fecha_entrega', hasta);

    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (decoded) query = query.or(cursorFilterDespuesDe('fecha_entrega', decoded));
    }

    query = query.limit(pageLimit);

    const { data, error } = await query;
    if (error) throw error;

    const rows = data ?? [];
    const ordenes = rows.map((row) => mapOrdenProduccionRow(row, row.orden_materiales_reservados));

    const last = rows.at(-1);
    const nextCursor =
      rows.length === pageLimit && last
        ? encodeCursor({ valor: last.fecha_entrega, id: last.id })
        : null;

    return NextResponse.json({ ok: true, data: ordenes, nextCursor });
  } catch (e) {
    console.error('[GET /api/ordenes-produccion]', e);
    return NextResponse.json({ error: 'Error al obtener órdenes' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user)           return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const parsed = CrearOrdenSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 });

  const { productoId, cantidad, fechaEntrega, proyectoId, notas } = parsed.data;

  try {
    // Verificar que el producto existe (404 amigable antes de intentar el RPC,
    // que sólo distingue BOM_NO_ENCONTRADO → 422)
    const { data: producto, error: prodError } = await supabaseAdmin
      .from('productos')
      .select('id')
      .eq('id', productoId)
      .maybeSingle();
    if (prodError) throw prodError;
    if (!producto) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });

    // Crea la OP en BORRADOR — la reserva de materiales se hace por el cliente
    // usando el endpoint PATCH /[id] { estado: 'EN_PROCESO' }. El contador anual
    // y el insert de la fila corren en una sola transacción implícita (RPC).
    const { data: orden, error } = await supabaseAdmin.rpc('crear_orden_produccion', {
      p_producto_id: productoId,
      p_cantidad: cantidad,
      p_fecha_entrega: fechaEntrega,
      // `supabase gen types` no marca este arg como nullable aunque el parámetro
      // Postgres (uuid, sin default) sí acepta NULL — cast documentado.
      p_proyecto_id: (proyectoId ?? null) as string,
      p_notas: notas,
      p_usuario_id: user.uid,
    });

    if (error) {
      if (error.message.startsWith('BOM_NO_ENCONTRADO')) {
        return NextResponse.json(
          { error: `El producto no tiene BOM configurado. Configúralo en /productos/${productoId}` },
          { status: 422 },
        );
      }
      throw error;
    }

    return NextResponse.json({ ok: true, id: orden.id, codigo: orden.codigo }, { status: 201 });
  } catch (e) {
    console.error('[POST /api/ordenes-produccion]', e);
    return NextResponse.json({ error: 'Error al crear orden de producción' }, { status: 500 });
  }
}
