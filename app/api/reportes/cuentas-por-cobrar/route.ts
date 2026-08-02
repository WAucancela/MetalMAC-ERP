/**
 * GET /api/reportes/cuentas-por-cobrar
 * Exporta las facturas de venta EMITIDAS con saldo pendiente y su antigüedad.
 *
 * Query params: format=csv (default) | json
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getAuthenticatedUser } from '@/app/api/_helpers';
import { calcularSaldoFactura, calcularAntiguedad } from '@/lib/services/finanzas.service';

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

  try {
    const { data: facturas, error: facturasError } = await supabaseAdmin
      .from('facturas_venta')
      .select('id, numero_factura, cliente_nombre, fecha_emision, fecha_vencimiento, total')
      .eq('estado', 'EMITIDA')
      .order('fecha_vencimiento', { ascending: true, nullsFirst: false });
    if (facturasError) throw facturasError;

    const ids = (facturas ?? []).map((f) => f.id);
    const { data: cobros, error: cobrosError } = ids.length
      ? await supabaseAdmin.from('cobros_factura_venta').select('factura_venta_id, monto').in('factura_venta_id', ids)
      : { data: [], error: null };
    if (cobrosError) throw cobrosError;

    const cobrosPorFactura = new Map<string, number[]>();
    for (const c of cobros ?? []) {
      const lista = cobrosPorFactura.get(c.factura_venta_id) ?? [];
      lista.push(Number(c.monto));
      cobrosPorFactura.set(c.factura_venta_id, lista);
    }

    const hoy = new Date();
    const rows = (facturas ?? [])
      .map((f) => ({
        numeroFactura: f.numero_factura,
        cliente: f.cliente_nombre,
        fechaEmision: f.fecha_emision,
        fechaVencimiento: f.fecha_vencimiento ?? '',
        total: Number(f.total),
        saldo: calcularSaldoFactura(Number(f.total), cobrosPorFactura.get(f.id) ?? []),
        antiguedad: calcularAntiguedad(f.fecha_vencimiento, hoy),
      }))
      .filter((f) => f.saldo > 0.01);

    if (format === 'json') {
      return NextResponse.json({ ok: true, data: rows, total: rows.length, generadoEn: new Date().toISOString() });
    }

    const header = 'Factura,Cliente,Fecha Emisión,Fecha Vencimiento,Total USD,Saldo USD,Antigüedad\n';
    const csvRows = rows.map((r) =>
      rowToCsv([r.numeroFactura, r.cliente, r.fechaEmision, r.fechaVencimiento, r.total.toFixed(2), r.saldo.toFixed(2), r.antiguedad]),
    );
    const csv = header + csvRows.join('\n') + '\n';

    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="cuentas_por_cobrar_${date}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    console.error('[GET /api/reportes/cuentas-por-cobrar]', e);
    return NextResponse.json({ error: 'Error al generar reporte' }, { status: 500 });
  }
}
