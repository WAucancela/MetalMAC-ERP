/**
 * GET /api/contabilidad/cuentas-por-pagar — facturas de compra con saldo
 * pendiente (total - pagos), con antigüedad de vencimiento. Excluye ANULADA.
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getAuthenticatedUser } from '@/app/api/_helpers';
import { calcularSaldoFactura, calcularAntiguedad } from '@/lib/services/finanzas.service';

// Nunca cachear: cada respuesta depende del usuario autenticado y de datos que cambian por request.
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

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
    const resultado = (facturas ?? [])
      .map((f) => {
        const saldo = calcularSaldoFactura(Number(f.total), pagosPorFactura.get(f.id) ?? []);
        return {
          id: f.id,
          numeroFactura: f.numero_factura,
          proveedorNombre: f.proveedores?.razon_social ?? null,
          fechaEmision: f.fecha_emision,
          fechaVencimiento: f.fecha_vencimiento,
          total: Number(f.total),
          saldo,
          antiguedad: calcularAntiguedad(f.fecha_vencimiento, hoy),
        };
      })
      .filter((f) => f.saldo > 0.01);

    return NextResponse.json({ ok: true, data: resultado });
  } catch (e) {
    console.error('[GET /api/contabilidad/cuentas-por-pagar]', e);
    return NextResponse.json({ error: 'Error al obtener cuentas por pagar' }, { status: 500 });
  }
}
