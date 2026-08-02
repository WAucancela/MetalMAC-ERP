/**
 * GET /api/reportes/caja-bancos
 * Exporta los movimientos de caja chica + bancos de un rango de fechas.
 *
 * Query params:
 *   desde=YYYY-MM-DD  (requerido)
 *   hasta=YYYY-MM-DD  (requerido)
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
  const format = searchParams.get('format') ?? 'csv';

  if (!desde || !hasta) {
    return NextResponse.json({ error: 'Parámetros requeridos: desde y hasta (YYYY-MM-DD)' }, { status: 400 });
  }

  try {
    const [{ data: caja, error: cajaError }, { data: bancarios, error: bancariosError }] = await Promise.all([
      supabaseAdmin.from('caja_chica_movimientos').select('fecha, tipo, monto, concepto').gte('fecha', desde).lte('fecha', hasta),
      supabaseAdmin
        .from('movimientos_bancarios')
        .select('fecha, tipo, monto, descripcion, conciliado, cuentas_bancarias(banco, numero_cuenta)')
        .gte('fecha', desde).lte('fecha', hasta),
    ]);
    if (cajaError) throw cajaError;
    if (bancariosError) throw bancariosError;

    const rows = [
      ...(caja ?? []).map((m) => ({
        fuente: 'Caja Chica',
        fecha: m.fecha,
        tipo: m.tipo,
        descripcion: m.concepto,
        monto: Number(m.monto),
        conciliado: '',
      })),
      ...(bancarios ?? []).map((m) => ({
        fuente: m.cuentas_bancarias ? `${m.cuentas_bancarias.banco} — ${m.cuentas_bancarias.numero_cuenta}` : 'Banco',
        fecha: m.fecha,
        tipo: m.tipo,
        descripcion: m.descripcion,
        monto: Number(m.monto),
        conciliado: m.conciliado ? 'Sí' : 'No',
      })),
    ].sort((a, b) => a.fecha.localeCompare(b.fecha));

    if (format === 'json') {
      return NextResponse.json({ ok: true, data: rows, total: rows.length, generadoEn: new Date().toISOString() });
    }

    const header = 'Fuente,Fecha,Tipo,Descripción,Monto USD,Conciliado\n';
    const csvRows = rows.map((r) =>
      rowToCsv([r.fuente, r.fecha, r.tipo, r.descripcion, r.monto.toFixed(2), r.conciliado]),
    );
    const csv = header + csvRows.join('\n') + '\n';

    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="caja_bancos_${desde}_${hasta}_${date}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    console.error('[GET /api/reportes/caja-bancos]', e);
    return NextResponse.json({ error: 'Error al generar reporte' }, { status: 500 });
  }
}
