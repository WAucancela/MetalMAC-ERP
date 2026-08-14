/**
 * GET  /api/cotizaciones — lista con filtros y paginación por cursor
 * POST /api/cotizaciones — crea una cotización en BORRADOR
 *
 * Igual que facturas-venta: los totales (subtotal/iva/total) se calculan acá,
 * nunca se confía en lo que mande el cliente.
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  getAuthenticatedUser, canWrite, puedeGestionarFinanzas, encodeCursor, decodeCursor, cursorFilterAntesDe,
} from '@/app/api/_helpers';
import { CotizacionSchema, CotizacionesQuerySchema } from '@/lib/validations/cotizaciones.schema';
import { mapCotizacionRow } from '@/lib/services/mappers';

// Nunca cachear: cada respuesta depende del usuario autenticado y de datos que cambian por request.
export const dynamic = 'force-dynamic';

const IVA_ECUADOR = 0.15;

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const queryParsed = CotizacionesQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!queryParsed.success) {
    return NextResponse.json({ error: 'Parámetros inválidos', detalles: queryParsed.error.flatten() }, { status: 400 });
  }
  const { estado, proyectoId, desde, hasta, limit: pageLimit, startAfter: cursor } = queryParsed.data;

  try {
    let query = supabaseAdmin
      .from('cotizaciones')
      .select('*, cotizacion_lineas(*)')
      .order('fecha_emision', { ascending: false })
      .order('id', { ascending: false });

    if (estado)     query = query.eq('estado', estado);
    if (proyectoId) query = query.eq('proyecto_id', proyectoId);
    if (desde)      query = query.gte('fecha_emision', desde);
    if (hasta)      query = query.lte('fecha_emision', hasta);

    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (decoded) query = query.or(cursorFilterAntesDe('fecha_emision', decoded));
    }
    query = query.limit(pageLimit);

    const { data, error } = await query;
    if (error) throw error;

    const rows = data ?? [];
    const cotizaciones = rows.map((row) => mapCotizacionRow(row, row.cotizacion_lineas));

    const last = rows.at(-1);
    const nextCursor =
      rows.length === pageLimit && last
        ? encodeCursor({ valor: last.fecha_emision, id: last.id })
        : null;

    return NextResponse.json({ ok: true, data: cotizaciones, nextCursor });
  } catch (e) {
    console.error('[GET /api/cotizaciones]', e);
    return NextResponse.json({ error: 'Error al obtener cotizaciones' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canWrite(user) && !puedeGestionarFinanzas(user)) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
  }

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const parsed = CotizacionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 });

  const data = parsed.data;

  const lineasConSubtotal = data.lineas.map((l) => ({
    ...l,
    subtotal: Math.round(l.cantidad * l.precioUnitario * 100) / 100,
  }));
  const subtotalSinIva = Math.round(lineasConSubtotal.reduce((acc, l) => acc + l.subtotal, 0) * 100) / 100;
  const iva = Math.round(subtotalSinIva * IVA_ECUADOR * 100) / 100;
  const total = Math.round((subtotalSinIva + iva) * 100) / 100;

  try {
    // Mismo contador genérico que OP-YYYY-NNNN / PRY-YYYY-NNNN (ver counters_and_triggers.sql).
    const anio = new Date(data.fechaEmision).getUTCFullYear();
    const { data: secuencia, error: secError } = await supabaseAdmin.rpc('siguiente_secuencia_anual', {
      p_prefijo: 'COT',
      p_anio: anio,
    });
    if (secError) throw secError;
    const numero = `COT-${anio}-${String(secuencia).padStart(4, '0')}`;

    const { data: cotizacion, error } = await supabaseAdmin
      .from('cotizaciones')
      .insert({
        numero,
        cliente_nombre: data.clienteNombre,
        cliente_email: data.clienteEmail,
        cliente_whatsapp: data.clienteWhatsapp,
        proyecto_id: data.proyectoId,
        fecha_emision: data.fechaEmision,
        fecha_vencimiento: data.fechaVencimiento,
        subtotal_sin_iva: subtotalSinIva,
        iva,
        total,
        notas: data.notas,
        estado: 'BORRADOR',
        creado_por: user.uid,
      })
      .select('id')
      .single();
    if (error) throw error;

    const { error: lineasError } = await supabaseAdmin.from('cotizacion_lineas').insert(
      lineasConSubtotal.map((l, orden) => ({
        cotizacion_id: cotizacion.id,
        orden,
        descripcion: l.descripcion,
        cantidad: l.cantidad,
        precio_unitario: l.precioUnitario,
        subtotal: l.subtotal,
        producto_id: l.productoId,
        material_id: l.materialId,
      })),
    );
    if (lineasError) throw lineasError;

    return NextResponse.json({ ok: true, id: cotizacion.id }, { status: 201 });
  } catch (e) {
    console.error('[POST /api/cotizaciones]', e);
    return NextResponse.json({ error: 'Error al crear la cotización' }, { status: 500 });
  }
}
