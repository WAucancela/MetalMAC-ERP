/**
 * GET /api/reportes/produccion
 * Exporta las órdenes de producción de un rango de fechas como CSV.
 *
 * Query params:
 *   desde=YYYY-MM-DD  (requerido)
 *   hasta=YYYY-MM-DD  (requerido)
 *   estado=BORRADOR|EN_PROCESO|COMPLETADA|CANCELADA (opcional)
 *   format=csv (default) | json
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getAuthenticatedUser } from '@/app/api/_helpers';
import type { EstadoOrdenProduccion } from '@/types/metalmac.types';

// Nunca cachear: cada respuesta depende del usuario autenticado y de datos que cambian por request.
export const dynamic = 'force-dynamic';

function escapeCsv(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function rowToCsv(fields: unknown[]): string {
  return fields.map(escapeCsv).join(',');
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const desdeStr = searchParams.get('desde');
  const hastaStr = searchParams.get('hasta');
  const estado   = searchParams.get('estado');
  const format   = searchParams.get('format') ?? 'csv';

  if (!desdeStr || !hastaStr) {
    return NextResponse.json(
      { error: 'Parámetros requeridos: desde y hasta (YYYY-MM-DD)' },
      { status: 400 },
    );
  }

  const desde = new Date(desdeStr + 'T00:00:00Z');
  const hasta = new Date(hastaStr + 'T23:59:59Z');

  if (isNaN(desde.getTime()) || isNaN(hasta.getTime())) {
    return NextResponse.json({ error: 'Fechas inválidas' }, { status: 400 });
  }

  try {
    // Un solo round trip: OP + nombre/unidad del producto (join vía FK)
    let query = supabaseAdmin
      .from('ordenes_produccion')
      .select('codigo, cantidad, estado, creado_en, fecha_entrega, costo_estimado, costo_real, proyecto_id, productos(nombre, unidad_venta)')
      .gte('creado_en', desde.toISOString())
      .lte('creado_en', hasta.toISOString())
      .order('creado_en', { ascending: true });

    if (estado) query = query.eq('estado', estado as EstadoOrdenProduccion);

    const { data, error } = await query;
    if (error) throw error;

    interface OPRow {
      codigo:          string;
      producto:        string;
      cantidad:        number;
      unidad:          string;
      estado:          string;
      creadoEn:        string;
      fechaEntrega:    string;
      costoEstimado:   number;
      costoReal:       number;
      proyectoId:      string;
    }

    const rows: OPRow[] = (data ?? []).map((op) => ({
      codigo:        op.codigo,
      producto:      op.productos?.nombre ?? '',
      cantidad:      Number(op.cantidad),
      unidad:        op.productos?.unidad_venta ?? '',
      estado:        op.estado,
      creadoEn:      op.creado_en.slice(0, 10),
      fechaEntrega:  op.fecha_entrega,
      costoEstimado: Number(op.costo_estimado),
      costoReal:     Number(op.costo_real ?? 0),
      proyectoId:    op.proyecto_id ?? '',
    }));

    if (format === 'json') {
      return NextResponse.json({
        ok: true,
        data: rows,
        total: rows.length,
        generadoEn: new Date().toISOString(),
      });
    }

    const header = 'Código OP,Producto,Cantidad,Unidad,Estado,Creada,Entrega,Costo Est. USD,Costo Real USD,Proyecto\n';
    const csvRows = rows.map((r) =>
      rowToCsv([
        r.codigo, r.producto, r.cantidad, r.unidad, r.estado,
        r.creadoEn, r.fechaEntrega, r.costoEstimado.toFixed(2), r.costoReal.toFixed(2), r.proyectoId,
      ]),
    );
    const csv = header + csvRows.join('\n') + '\n';

    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="produccion_${desdeStr}_${hastaStr}_${date}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    console.error('[GET /api/reportes/produccion]', e);
    return NextResponse.json({ error: 'Error al generar reporte' }, { status: 500 });
  }
}
