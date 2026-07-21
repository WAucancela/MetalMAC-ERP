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
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { getAuthenticatedUser } from '@/app/api/_helpers';

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

function tsToDate(ts: unknown): string {
  if (!ts) return '';
  if (ts instanceof Timestamp) return ts.toDate().toISOString().slice(0, 10);
  if (typeof ts === 'object' && ts !== null && 'seconds' in ts) {
    return new Date((ts as { seconds: number }).seconds * 1000).toISOString().slice(0, 10);
  }
  return '';
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
    let query = adminDb
      .collection('ordenes_produccion')
      .where('creadoEn', '>=', Timestamp.fromDate(desde))
      .where('creadoEn', '<=', Timestamp.fromDate(hasta))
      .orderBy('creadoEn', 'asc');

    if (estado) {
      query = query.where('estado', '==', estado) as typeof query;
    }

    const snap = await query.get();

    // Enriquecer con nombre de producto
    const productoIds = [...new Set(snap.docs.map((d) => d.data().productoId as string).filter(Boolean))];
    const productosMap: Record<string, string> = {};

    const BATCH = 30;
    for (let i = 0; i < productoIds.length; i += BATCH) {
      const chunk = productoIds.slice(i, i + BATCH);
      const pSnap = await adminDb.collection('productos').where('__name__', 'in', chunk).get();
      pSnap.docs.forEach((d) => { productosMap[d.id] = d.data().nombre ?? d.id; });
    }

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

    const rows: OPRow[] = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        codigo:        d.codigo         ?? '',
        producto:      productosMap[d.productoId] ?? d.productoId ?? '',
        cantidad:      Number(d.cantidad ?? 0),
        unidad:        d.unidadId       ?? '',
        estado:        d.estado         ?? '',
        creadoEn:      tsToDate(d.creadoEn),
        fechaEntrega:  tsToDate(d.fechaEntrega),
        costoEstimado: Number(d.costoEstimado ?? 0),
        costoReal:     Number(d.costoReal     ?? 0),
        proyectoId:    d.proyectoId     ?? '',
      };
    });

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
