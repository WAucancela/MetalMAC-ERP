/**
 * GET  /api/contabilidad/facturas  — lista con filtros y paginación
 * POST /api/contabilidad/facturas  — crea una factura de compra
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  getAuthenticatedUser, canWrite, encodeCursor, decodeCursor, cursorFilterAntesDe,
} from '@/app/api/_helpers';
import { FacturaCompraSchema, FacturasQuerySchema } from '@/lib/validations/sri.schema';
import { mapFacturaCompraRow } from '@/lib/services/mappers';

// Nunca cachear: cada respuesta depende del usuario autenticado y de datos que cambian por request.
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const queryParsed = FacturasQuerySchema.safeParse(Object.fromEntries(searchParams));

  if (!queryParsed.success) {
    return NextResponse.json(
      { error: 'Parámetros inválidos', detalles: queryParsed.error.flatten() },
      { status: 400 },
    );
  }

  const { proveedorId, estado, desde, hasta, limit: pageLimit, startAfter: cursor } = queryParsed.data;

  try {
    let query = supabaseAdmin
      .from('facturas_compra')
      .select('*, factura_compra_lineas(*), factura_compra_retenciones(*)')
      .order('fecha_emision', { ascending: false })
      .order('id', { ascending: false });

    if (proveedorId) query = query.eq('proveedor_id', proveedorId);
    if (estado)      query = query.eq('estado', estado);
    if (desde)       query = query.gte('fecha_emision', desde);
    if (hasta)       query = query.lte('fecha_emision', hasta);

    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (decoded) query = query.or(cursorFilterAntesDe('fecha_emision', decoded));
    }
    query = query.limit(pageLimit);

    const { data, error } = await query;
    if (error) throw error;

    const rows = data ?? [];
    const facturas = rows.map((row) =>
      mapFacturaCompraRow(row, row.factura_compra_lineas, row.factura_compra_retenciones),
    );

    const last = rows.at(-1);
    const nextCursor =
      rows.length === pageLimit && last
        ? encodeCursor({ valor: last.fecha_emision, id: last.id })
        : null;

    return NextResponse.json({ ok: true, data: facturas, nextCursor });
  } catch (e) {
    console.error('[GET /api/contabilidad/facturas]', e);
    return NextResponse.json({ error: 'Error al obtener facturas' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user)         return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ error: 'Sin permiso de escritura' }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const parsed = FacturaCompraSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', detalles: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = parsed.data;

  try {
    const { data: factura, error } = await supabaseAdmin
      .from('facturas_compra')
      .insert({
        proveedor_id: data.proveedorId,
        clave_acceso: data.claveAcceso,
        numero_factura: data.numeroFactura,
        fecha_emision: data.fechaEmision,
        subtotal_sin_iva: data.subtotalSinIva,
        iva: data.iva,
        total: data.total,
        xml_url: data.xmlUrl,
        estado: data.estado,
      })
      .select('id')
      .single();

    if (error) {
      // Violación de unicidad de claveAcceso (reemplaza el pre-chequeo + 409 de
      // la versión Firestore, que no era atómico frente al insert)
      if (error.code === '23505') {
        return NextResponse.json(
          { error: `Ya existe una factura con la clave de acceso ${data.claveAcceso}` },
          { status: 409 },
        );
      }
      throw error;
    }

    if (data.lineas.length > 0) {
      const { error: lineasError } = await supabaseAdmin.from('factura_compra_lineas').insert(
        data.lineas.map((l, orden) => ({
          factura_id: factura.id,
          orden,
          codigo_proveedor: l.codigoProveedor,
          descripcion: l.descripcion,
          cantidad: l.cantidad,
          precio_unitario: l.precioUnitario,
          descuento: l.descuento,
          subtotal: l.subtotal,
          material_id: l.materialId,
          cantidad_convertida: l.cantidadConvertida,
        })),
      );
      if (lineasError) throw lineasError;
    }

    if (data.retenciones.length > 0) {
      const { error: retencionesError } = await supabaseAdmin.from('factura_compra_retenciones').insert(
        data.retenciones.map((r) => ({
          factura_id: factura.id,
          tipo: r.tipo,
          porcentaje: r.porcentaje,
          base: r.base,
          valor: r.valor,
        })),
      );
      if (retencionesError) throw retencionesError;
    }

    return NextResponse.json({ ok: true, id: factura.id }, { status: 201 });
  } catch (e) {
    console.error('[POST /api/contabilidad/facturas]', e);
    return NextResponse.json({ error: 'Error al crear factura' }, { status: 500 });
  }
}
