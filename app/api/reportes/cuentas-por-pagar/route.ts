/**
 * GET /api/reportes/cuentas-por-pagar
 * Exporta las facturas de compra con saldo pendiente y su antigüedad.
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
      .from('facturas_compra')
      .select('id, numero_factura, fecha_emision, fecha_vencimiento, total, proveedores(razon_social)')
      .neq('estado', 'ANULADA')
      .order('fecha_vencimiento', { ascending: true, nullsFirst: false });
    if (facturasError) throw facturasError;

    const ids = (facturas ?? []).map((f) => f.id);
    const { data: pagos, error: pagosError } = ids.length
      ? await supabaseAdmin.from('pagos_factura_compra').select('factura_compra_id, monto').in('factura_compra_id', ids)
      : { data: [], error: null };
    if (pagosError) throw pagosError;

    const pagosPorFactura = new Map<string, number[]>();
    for (const p of pagos ?? []) {
      const lista = pagosPorFactura.get(p.factura_compra_id) ?? [];
      lista.push(Number(p.monto));
      pagosPorFactura.set(p.factura_compra_id, lista);
    }

    const hoy = new Date();
    const rows = (facturas ?? [])
      .map((f) => ({
        numeroFactura: f.numero_factura,
        proveedor: f.proveedores?.razon_social ?? '',
        fechaEmision: f.fecha_emision,
        fechaVencimiento: f.fecha_vencimiento ?? '',
        total: Number(f.total),
        saldo: calcularSaldoFactura(Number(f.total), pagosPorFactura.get(f.id) ?? []),
        antiguedad: calcularAntiguedad(f.fecha_vencimiento, hoy),
      }))
      .filter((f) => f.saldo > 0.01);

    if (format === 'json') {
      return NextResponse.json({ ok: true, data: rows, total: rows.length, generadoEn: new Date().toISOString() });
    }

    const header = 'Factura,Proveedor,Fecha Emisión,Fecha Vencimiento,Total USD,Saldo USD,Antigüedad\n';
    const csvRows = rows.map((r) =>
      rowToCsv([r.numeroFactura, r.proveedor, r.fechaEmision, r.fechaVencimiento, r.total.toFixed(2), r.saldo.toFixed(2), r.antiguedad]),
    );
    const csv = header + csvRows.join('\n') + '\n';

    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="cuentas_por_pagar_${date}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    console.error('[GET /api/reportes/cuentas-por-pagar]', e);
    return NextResponse.json({ error: 'Error al generar reporte' }, { status: 500 });
  }
}
