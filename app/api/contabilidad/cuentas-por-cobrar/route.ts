/**
 * GET /api/contabilidad/cuentas-por-cobrar — facturas de venta EMITIDAS con
 * saldo pendiente (total - cobros), con antigüedad de vencimiento.
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
    const resultado = (facturas ?? [])
      .map((f) => {
        const saldo = calcularSaldoFactura(Number(f.total), cobrosPorFactura.get(f.id) ?? []);
        return {
          id: f.id,
          numeroFactura: f.numero_factura,
          clienteNombre: f.cliente_nombre,
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
    console.error('[GET /api/contabilidad/cuentas-por-cobrar]', e);
    return NextResponse.json({ error: 'Error al obtener cuentas por cobrar' }, { status: 500 });
  }
}
