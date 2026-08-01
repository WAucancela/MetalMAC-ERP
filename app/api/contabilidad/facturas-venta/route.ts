/**
 * GET  /api/contabilidad/facturas-venta  — lista con filtros y paginación
 * POST /api/contabilidad/facturas-venta  — crea una factura de venta en BORRADOR
 *
 * Fase 1: solo registro manual dentro del ERP — no genera XML, no firma, no envía nada
 * al SRI. `numero_factura`/`clave_acceso` reales se cargan después, al marcar la
 * factura como EMITIDA (ver [id]/route.ts PATCH), con lo que devuelve el portal
 * "Facturación en línea" del SRI que el staff sigue usando mientras tanto.
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  getAuthenticatedUser, canWrite, encodeCursor, decodeCursor, cursorFilterAntesDe,
} from '@/app/api/_helpers';
import { FacturaVentaSchema, FacturasVentaQuerySchema } from '@/lib/validations/ventas.schema';
import { mapFacturaVentaRow } from '@/lib/services/mappers';

const IVA_ECUADOR = 0.15;

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const queryParsed = FacturasVentaQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!queryParsed.success) {
    return NextResponse.json(
      { error: 'Parámetros inválidos', detalles: queryParsed.error.flatten() },
      { status: 400 },
    );
  }

  const { proyectoId, estado, desde, hasta, limit: pageLimit, startAfter: cursor } = queryParsed.data;

  try {
    let query = supabaseAdmin
      .from('facturas_venta')
      .select('*, factura_venta_lineas(*)')
      .order('fecha_emision', { ascending: false })
      .order('id', { ascending: false });

    if (proyectoId) query = query.eq('proyecto_id', proyectoId);
    if (estado)     query = query.eq('estado', estado);
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
    const facturas = rows.map((row) => mapFacturaVentaRow(row, row.factura_venta_lineas));

    const last = rows.at(-1);
    const nextCursor =
      rows.length === pageLimit && last
        ? encodeCursor({ valor: last.fecha_emision, id: last.id })
        : null;

    return NextResponse.json({ ok: true, data: facturas, nextCursor });
  } catch (e) {
    console.error('[GET /api/contabilidad/facturas-venta]', e);
    return NextResponse.json({ error: 'Error al obtener facturas de venta' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user)           return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ error: 'Sin permiso de escritura' }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const parsed = FacturaVentaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  // Totales calculados en el server — nunca confiados del cliente.
  const lineasConSubtotal = data.lineas.map((l) => ({
    ...l,
    subtotal: Math.round(l.cantidad * l.precioUnitario * 100) / 100,
  }));
  const subtotalSinIva = Math.round(lineasConSubtotal.reduce((acc, l) => acc + l.subtotal, 0) * 100) / 100;
  const iva = Math.round(subtotalSinIva * IVA_ECUADOR * 100) / 100;
  const total = Math.round((subtotalSinIva + iva) * 100) / 100;

  try {
    const { data: factura, error } = await supabaseAdmin
      .from('facturas_venta')
      .insert({
        proyecto_id: data.proyectoId,
        cliente_nombre: data.clienteNombre,
        cliente_ruc: data.clienteRuc,
        cliente_email: data.clienteEmail,
        numero_factura: '',
        fecha_emision: data.fechaEmision,
        subtotal_sin_iva: subtotalSinIva,
        iva,
        total,
        estado: 'BORRADOR',
        creado_por: user.uid,
      })
      .select('id')
      .single();

    if (error) throw error;

    const { error: lineasError } = await supabaseAdmin.from('factura_venta_lineas').insert(
      lineasConSubtotal.map((l, orden) => ({
        factura_id: factura.id,
        orden,
        descripcion: l.descripcion,
        cantidad: l.cantidad,
        precio_unitario: l.precioUnitario,
        subtotal: l.subtotal,
        orden_produccion_id: l.ordenProduccionId,
      })),
    );
    if (lineasError) throw lineasError;

    return NextResponse.json({ ok: true, id: factura.id }, { status: 201 });
  } catch (e) {
    console.error('[POST /api/contabilidad/facturas-venta]', e);
    return NextResponse.json({ error: 'Error al crear factura de venta' }, { status: 500 });
  }
}
