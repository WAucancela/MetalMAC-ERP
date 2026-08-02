/**
 * GET  /api/gastos  — lista gastos con filtros (proyecto opcional — sin
 *                     proyectoId es un gasto general/administrativo)
 * POST /api/gastos  — registra gasto (el trigger sobre la tabla `gastos`
 *                     mantiene proyectos.costo_real automáticamente cuando
 *                     hay proyecto asociado; si no hay, no toca nada)
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  getAuthenticatedUser, canWrite, puedeGestionarFinanzas, encodeCursor, decodeCursor, cursorFilterAntesDe,
} from '@/app/api/_helpers';
import { GastoSchema, GastosQuerySchema } from '@/lib/validations/proyectos.schema';
import { mapGastoRow } from '@/lib/services/mappers';

// Nunca cachear: cada respuesta depende del usuario autenticado y de datos que cambian por request.
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const qp = GastosQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!qp.success) return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });

  const { proyectoId, centroCostoId, categoria, desde, hasta, limit: pageLimit, startAfter: cursor } = qp.data;

  try {
    let query = supabaseAdmin
      .from('gastos')
      .select('*')
      .order('fecha', { ascending: false })
      .order('id', { ascending: false });

    if (proyectoId)    query = query.eq('proyecto_id', proyectoId);
    if (centroCostoId) query = query.eq('centro_costo_id', centroCostoId);
    if (categoria)     query = query.eq('categoria', categoria);
    if (desde)         query = query.gte('fecha', desde);
    if (hasta)         query = query.lte('fecha', hasta);

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

    return NextResponse.json({ ok: true, data: rows.map(mapGastoRow), nextCursor });
  } catch (e) {
    console.error('[GET /api/gastos]', e);
    return NextResponse.json({ error: 'Error al obtener gastos' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  // BODEGUERO ya podía cargar gastos de proyecto antes de esta generalización — se
  // mantiene, y se suma CONTABILIDAD para los gastos generales/administrativos.
  if (!canWrite(user) && !puedeGestionarFinanzas(user)) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
  }

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const parsed = GastoSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 });

  const { proyectoId, centroCostoId, categoria, descripcion, monto, fecha, proveedorId, facturaId, ordenId, comprobante } = parsed.data;

  try {
    // Si viene con proyecto, verificar que exista antes de insertar.
    if (proyectoId) {
      const { data: proyecto, error: proyectoError } = await supabaseAdmin
        .from('proyectos')
        .select('id')
        .eq('id', proyectoId)
        .maybeSingle();
      if (proyectoError) throw proyectoError;
      if (!proyecto) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
    }

    // Insert plano — el trigger trg_gastos_proyecto_costo_real actualiza
    // proyectos.costo_real (solo si hay proyecto_id) dentro de la misma
    // transacción implícita del INSERT.
    const { data: gasto, error } = await supabaseAdmin
      .from('gastos')
      .insert({
        proyecto_id: proyectoId ?? null,
        centro_costo_id: centroCostoId ?? null,
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
    console.error('[POST /api/gastos]', e);
    return NextResponse.json({ error: 'Error al registrar gasto' }, { status: 500 });
  }
}
