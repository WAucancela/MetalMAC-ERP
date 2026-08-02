/**
 * GET  /api/gastos-proyecto  — lista gastos con filtros
 * POST /api/gastos-proyecto  — registra gasto (el trigger sobre gastos_proyecto
 *                              mantiene proyectos.costo_real automáticamente)
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  getAuthenticatedUser, canWrite, encodeCursor, decodeCursor, cursorFilterAntesDe,
} from '@/app/api/_helpers';
import { GastoSchema, GastosQuerySchema } from '@/lib/validations/proyectos.schema';
import { mapGastoProyectoRow } from '@/lib/services/mappers';

// Nunca cachear: cada respuesta depende del usuario autenticado y de datos que cambian por request.
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const qp = GastosQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!qp.success) return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });

  const { proyectoId, categoria, desde, hasta, limit: pageLimit, startAfter: cursor } = qp.data;

  try {
    let query = supabaseAdmin
      .from('gastos_proyecto')
      .select('*')
      .order('fecha', { ascending: false })
      .order('id', { ascending: false });

    if (proyectoId) query = query.eq('proyecto_id', proyectoId);
    if (categoria)  query = query.eq('categoria', categoria);
    if (desde)      query = query.gte('fecha', desde);
    if (hasta)      query = query.lte('fecha', hasta);

    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (decoded) query = query.or(cursorFilterAntesDe('fecha', decoded));
    }
    query = query.limit(pageLimit);

    const { data, error } = await query;
    if (error) throw error;

    const rows = data ?? [];
    const last = rows.at(-1);
    const nextCursor =
      rows.length === pageLimit && last
        ? encodeCursor({ valor: last.fecha, id: last.id })
        : null;

    return NextResponse.json({ ok: true, data: rows.map(mapGastoProyectoRow), nextCursor });
  } catch (e) {
    console.error('[GET /api/gastos-proyecto]', e);
    return NextResponse.json({ error: 'Error al obtener gastos' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user)           return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const parsed = GastoSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 });

  const { proyectoId, categoria, descripcion, monto, fecha, proveedorId, facturaId, ordenId, comprobante } = parsed.data;

  try {
    // Verificar que el proyecto existe
    const { data: proyecto, error: proyectoError } = await supabaseAdmin
      .from('proyectos')
      .select('id')
      .eq('id', proyectoId)
      .maybeSingle();
    if (proyectoError) throw proyectoError;
    if (!proyecto) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });

    // Insert plano — el trigger trg_gastos_proyecto_costo_real actualiza
    // proyectos.costo_real dentro de la misma transacción implícita del INSERT,
    // cerrando la race condition que tenía la versión Firestore (lectura de
    // costoReal fuera de la transacción, ver plan de migración).
    const { data: gasto, error } = await supabaseAdmin
      .from('gastos_proyecto')
      .insert({
        proyecto_id: proyectoId,
        categoria,
        descripcion,
        monto,
        fecha,
        proveedor_id: proveedorId ?? null,
        factura_id: facturaId ?? null,
        orden_id: ordenId ?? null,
        comprobante: comprobante ?? null,
        creado_por: user.uid,
      })
      .select('id')
      .single();
    if (error) throw error;

    return NextResponse.json({ ok: true, id: gasto.id }, { status: 201 });
  } catch (e) {
    console.error('[POST /api/gastos-proyecto]', e);
    return NextResponse.json({ error: 'Error al registrar gasto' }, { status: 500 });
  }
}
