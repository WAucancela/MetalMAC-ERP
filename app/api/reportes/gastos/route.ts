/**
 * GET /api/reportes/gastos
 * Exporta los gastos (generales + de proyecto) de un rango de fechas.
 *
 * Query params:
 *   desde=YYYY-MM-DD  (requerido)
 *   hasta=YYYY-MM-DD  (requerido)
 *   centroCostoId (opcional)
 *   format=csv (default) | json
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getAuthenticatedUser } from '@/app/api/_helpers';

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
  const desde = searchParams.get('desde');
  const hasta = searchParams.get('hasta');
  const centroCostoId = searchParams.get('centroCostoId');
  const format = searchParams.get('format') ?? 'csv';

  if (!desde || !hasta) {
    return NextResponse.json({ error: 'Parámetros requeridos: desde y hasta (YYYY-MM-DD)' }, { status: 400 });
  }

  try {
    let query = supabaseAdmin
      .from('gastos')
      .select('fecha, categoria, descripcion, monto, proyecto_id, proyectos(codigo), centros_costo(codigo, nombre)')
      .gte('fecha', desde)
      .lte('fecha', hasta)
      .order('fecha', { ascending: true });

    if (centroCostoId) query = query.eq('centro_costo_id', centroCostoId);

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data ?? []).map((g) => ({
      fecha: g.fecha,
      categoria: g.categoria,
      descripcion: g.descripcion,
      monto: Number(g.monto),
      proyecto: g.proyectos?.codigo ?? '',
      centroCosto: g.centros_costo ? `${g.centros_costo.codigo} — ${g.centros_costo.nombre}` : '',
    }));

    if (format === 'json') {
      return NextResponse.json({ ok: true, data: rows, total: rows.length, generadoEn: new Date().toISOString() });
    }

    const header = 'Fecha,Categoría,Descripción,Monto USD,Proyecto,Centro de Costo\n';
    const csvRows = rows.map((r) =>
      rowToCsv([r.fecha, r.categoria, r.descripcion, r.monto.toFixed(2), r.proyecto, r.centroCosto]),
    );
    const csv = header + csvRows.join('\n') + '\n';

    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="gastos_${desde}_${hasta}_${date}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    console.error('[GET /api/reportes/gastos]', e);
    return NextResponse.json({ error: 'Error al generar reporte' }, { status: 500 });
  }
}
