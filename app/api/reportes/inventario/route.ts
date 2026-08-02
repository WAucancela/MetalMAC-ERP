/**
 * GET /api/reportes/inventario
 * Exporta el stock actual de todos los materiales activos como CSV.
 *
 * Query params:
 *   format=csv (default) | json
 *   tipo=PLANCHA | TUBO | PERFIL | VARILLA | CONSUMIBLE (opcional)
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getAuthenticatedUser } from '@/app/api/_helpers';
import type { TipoMaterial } from '@/types/metalmac.types';

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
  const format = searchParams.get('format') ?? 'csv';
  const tipo   = searchParams.get('tipo');

  try {
    // Un solo round trip: materiales activos + su stock + su unidad de medida (joins vía FK)
    let query = supabaseAdmin
      .from('materiales')
      .select('codigo_interno, nombre, tipo, unidad_base_id, stock(*), unidades_medida(simbolo, nombre)')
      .eq('activo', true);
    if (tipo) query = query.eq('tipo', tipo as TipoMaterial);

    const { data, error } = await query;
    if (error) throw error;

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

    const rows: ReporteRow[] = (data ?? []).map((mat) => {
      const stock = mat.stock;
      const unidad = mat.unidades_medida;
      return {
        codigoInterno: mat.codigo_interno,
        nombre: mat.nombre,
        tipo: mat.tipo,
        unidad: unidad?.simbolo ?? unidad?.nombre ?? mat.unidad_base_id,
        disponible: Number(stock?.cantidad_disponible ?? 0),
        reservada: Number(stock?.cantidad_reservada ?? 0),
        minima: Number(stock?.cantidad_minima ?? 0),
        ubicacion: stock?.ubicacion ?? '',
      };
    });

    rows.sort((a, b) => a.codigoInterno.localeCompare(b.codigoInterno));

    if (format === 'json') {
      return NextResponse.json({ ok: true, data: rows, generadoEn: new Date().toISOString() });
    }

    if (rows.length === 0) {
      return new NextResponse('Código Interno,Nombre,Tipo,Unidad,Disponible,Reservada,Mínima,Ubicación\n', {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="inventario.csv"',
        },
      });
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
