/**
 * GET /api/reportes/inventario
 * Exporta el stock actual de todos los materiales activos como CSV.
 *
 * Query params:
 *   format=csv (default) | json
 *   tipo=MATERIA_PRIMA | INSUMO | HERRAMIENTA (opcional)
 */

import { NextResponse } from 'next/server';
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

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') ?? 'csv';
  const tipo   = searchParams.get('tipo');

  try {
    // 1. Obtener materiales activos
    let matQuery = adminDb.collection('materiales').where('activo', '==', true);
    if (tipo) matQuery = matQuery.where('tipo', '==', tipo) as typeof matQuery;
    const matSnap = await matQuery.get();

    if (matSnap.empty) {
      if (format === 'json') return NextResponse.json({ ok: true, data: [] });
      return new NextResponse('codigoInterno,nombre,tipo,unidad,disponible,reservada,minima,ubicacion\n', {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="inventario.csv"',
        },
      });
    }

    // 2. Obtener stock de todos los materiales en batch
    const materialIds = matSnap.docs.map((d) => d.id);

    // Batches de 30 para whereIn
    const BATCH = 30;
    const stockDocs: Record<string, Record<string, unknown>> = {};
    for (let i = 0; i < materialIds.length; i += BATCH) {
      const chunk = materialIds.slice(i, i + BATCH);
      const stockSnap = await adminDb
        .collection('stock')
        .where('__name__', 'in', chunk)
        .get();
      stockSnap.docs.forEach((d) => { stockDocs[d.id] = d.data(); });
    }

    // 3. Obtener unidades de medida
    const unidadesSnap = await adminDb.collection('unidades_medida').get();
    const unidades: Record<string, string> = {};
    unidadesSnap.docs.forEach((d) => { unidades[d.id] = d.data().simbolo ?? d.data().nombre; });

    // 4. Construir rows
    interface ReporteRow {
      codigoInterno: string;
      nombre: string;
      tipo: string;
      unidad: string;
      disponible: number;
      reservada: number;
      minima: number;
      ubicacion: string;
    }

    const rows: ReporteRow[] = matSnap.docs.map((doc) => {
      const mat = doc.data();
      const stock = stockDocs[doc.id] ?? {};
      return {
        codigoInterno: mat.codigoInterno ?? '',
        nombre:        mat.nombre ?? '',
        tipo:          mat.tipo ?? '',
        unidad:        unidades[mat.unidadId] ?? mat.unidadId ?? '',
        disponible:    Number(stock.cantidadDisponible ?? 0),
        reservada:     Number(stock.cantidadReservada  ?? 0),
        minima:        Number(stock.cantidadMinima     ?? 0),
        ubicacion:     String(stock.ubicacion          ?? ''),
      };
    });

    rows.sort((a, b) => a.codigoInterno.localeCompare(b.codigoInterno));

    if (format === 'json') {
      return NextResponse.json({ ok: true, data: rows, generadoEn: new Date().toISOString() });
    }

    // CSV
    const header = 'Código Interno,Nombre,Tipo,Unidad,Disponible,Reservada,Mínima,Ubicación\n';
    const csvRows = rows.map((r) =>
      rowToCsv([r.codigoInterno, r.nombre, r.tipo, r.unidad, r.disponible, r.reservada, r.minima, r.ubicacion]),
    );
    const csv = header + csvRows.join('\n') + '\n';

    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="inventario_${date}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    console.error('[GET /api/reportes/inventario]', e);
    return NextResponse.json({ error: 'Error al generar reporte' }, { status: 500 });
  }
}
