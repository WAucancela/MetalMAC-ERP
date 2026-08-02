/**
 * GET /api/dashboard/kpis
 *
 * Agrega en paralelo los KPIs de los 4 módulos:
 *   - inventario:    materiales bajo stock mínimo
 *   - produccion:    OPs por estado, completadas hoy
 *   - contabilidad:  facturas pendientes, monto total pendiente
 *   - proyectos:     proyectos activos, presupuesto vs ejecutado
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getAuthenticatedUser } from '@/app/api/_helpers';
import { obtenerAlertasStockBajo } from '@/lib/services/inventario.service';

// Nunca cachear: cada respuesta depende del usuario autenticado y de datos que cambian por request.
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setDate(hoy.getDate() + 1);
    const hoyStr = hoy.toISOString().slice(0, 10);

    const [
      alertasStock,
      opsBorrador,
      opsEnProceso,
      opsCompletadasHoy,
      opsVencidas,
      facturasPendientesResult,
      proyectosActivosResult,
    ] = await Promise.all([
      obtenerAlertasStockBajo(),
      supabaseAdmin.from('ordenes_produccion').select('id', { count: 'exact', head: true }).eq('estado', 'BORRADOR'),
      supabaseAdmin.from('ordenes_produccion').select('id', { count: 'exact', head: true }).eq('estado', 'EN_PROCESO'),
      supabaseAdmin.from('ordenes_produccion').select('id', { count: 'exact', head: true })
        .eq('estado', 'COMPLETADA')
        .gte('fecha_completada', hoy.toISOString())
        .lt('fecha_completada', manana.toISOString()),
      supabaseAdmin.from('ordenes_produccion').select('id', { count: 'exact', head: true })
        .in('estado', ['BORRADOR', 'EN_PROCESO'])
        .lt('fecha_entrega', hoyStr),
      supabaseAdmin.from('facturas_compra')
        .select('id, numero_factura, total, proveedores(razon_social)')
        .eq('estado', 'PENDIENTE')
        .order('fecha_emision', { ascending: false })
        .limit(200),
      supabaseAdmin.from('proyectos').select('id, codigo, nombre, cliente, presupuesto, costo_real').eq('estado', 'ACTIVO'),
    ]);

    if (opsBorrador.error) throw opsBorrador.error;
    if (opsEnProceso.error) throw opsEnProceso.error;
    if (opsCompletadasHoy.error) throw opsCompletadasHoy.error;
    if (opsVencidas.error) throw opsVencidas.error;
    if (facturasPendientesResult.error) throw facturasPendientesResult.error;
    if (proyectosActivosResult.error) throw proyectosActivosResult.error;

    // ── Contabilidad ──────────────────────────────────────────────────────────
    const facturasPendientes = facturasPendientesResult.data ?? [];
    const montoPendiente = facturasPendientes.reduce((acc, f) => acc + Number(f.total), 0);
    const facturasUltimas5 = facturasPendientes.slice(0, 5).map((f) => ({
      id: f.id,
      numeroFactura: f.numero_factura,
      razonSocialProveedor: f.proveedores?.razon_social ?? null,
      total: Number(f.total),
    }));

    // ── Proyectos ─────────────────────────────────────────────────────────────
    const proyectosActivos = (proyectosActivosResult.data ?? []).map((p) => ({
      id: p.id,
      codigo: p.codigo,
      nombre: p.nombre,
      cliente: p.cliente,
      presupuesto: Number(p.presupuesto),
      costoReal: Number(p.costo_real),
    }));

    const presupuestoTotalActivos = proyectosActivos.reduce((s, p) => s + p.presupuesto, 0);
    const ejecutadoTotalActivos   = proyectosActivos.reduce((s, p) => s + p.costoReal, 0);
    const proyectosEnRiesgo = proyectosActivos.filter(
      (p) => p.presupuesto > 0 && (p.costoReal / p.presupuesto) >= 0.85,
    );

    return NextResponse.json({
      ok: true,
      generadoEn: new Date().toISOString(),
      data: {
        inventario: {
          materialesBajoStock: alertasStock.length,
          materialIdsAlerta: alertasStock.slice(0, 10).map((a) => a.materialId),
        },
        produccion: {
          opsBorrador:       opsBorrador.count ?? 0,
          opsEnProceso:      opsEnProceso.count ?? 0,
          opsCompletadasHoy: opsCompletadasHoy.count ?? 0,
          opsVencidas:       opsVencidas.count ?? 0,
          totalActivas:      (opsBorrador.count ?? 0) + (opsEnProceso.count ?? 0),
        },
        contabilidad: {
          facturasPendientes: facturasPendientes.length,
          montoPendiente: Math.round(montoPendiente * 100) / 100,
          facturasUltimas5,
        },
        proyectos: {
          proyectosActivos: proyectosActivos.length,
          presupuestoTotalActivos: Math.round(presupuestoTotalActivos * 100) / 100,
          ejecutadoTotalActivos:   Math.round(ejecutadoTotalActivos * 100) / 100,
          proyectosEnRiesgo: proyectosEnRiesgo.length,
          detalleRiesgo: proyectosEnRiesgo,
        },
      },
    });
  } catch (e) {
    console.error('[GET /api/dashboard/kpis]', e);
    return NextResponse.json({ error: 'Error al calcular KPIs' }, { status: 500 });
  }
}
