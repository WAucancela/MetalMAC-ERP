/**
 * GET /api/dashboard/kpis
 *
 * Agrega en paralelo los KPIs de los módulos:
 *   - inventario:      materiales bajo stock mínimo
 *   - produccion:      OPs por estado, completadas hoy
 *   - contabilidad:    facturas de compra pendientes (estado de documento, no saldo)
 *   - proyectos:       proyectos activos, presupuesto vs ejecutado
 *   - cuentasPorCobrar/cuentasPorPagar: saldo real (total - cobros/pagos), no solo estado
 *   - tesoreria:       saldo de caja chica + bancos
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getAuthenticatedUser } from '@/app/api/_helpers';
import { obtenerAlertasStockBajo } from '@/lib/services/inventario.service';
import { calcularSaldoFactura, calcularAntiguedad } from '@/lib/services/finanzas.service';
import { calcularSaldoCuenta } from '@/lib/services/bancos.service';
import { calcularSaldoCaja } from '@/lib/services/caja.service';

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
      facturasCompraResult,
      pagosCompraResult,
      facturasVentaResult,
      cobrosVentaResult,
      cajaMovimientosResult,
      cuentasBancariasResult,
      movimientosBancariosResult,
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
      // ── Cuentas por pagar (saldo real, no solo estado del documento) ──────────
      supabaseAdmin.from('facturas_compra')
        .select('id, numero_factura, fecha_vencimiento, total, proveedores(razon_social)')
        .neq('estado', 'ANULADA'),
      supabaseAdmin.from('pagos_factura_compra').select('factura_compra_id, monto'),
      // ── Cuentas por cobrar ──────────────────────────────────────────────────
      supabaseAdmin.from('facturas_venta')
        .select('id, numero_factura, fecha_vencimiento, total, cliente_nombre')
        .eq('estado', 'EMITIDA'),
      supabaseAdmin.from('cobros_factura_venta').select('factura_venta_id, monto'),
      // ── Tesorería ─────────────────────────────────────────────────────────────
      supabaseAdmin.from('caja_chica_movimientos').select('tipo, monto'),
      supabaseAdmin.from('cuentas_bancarias').select('id, banco, numero_cuenta, saldo_inicial').eq('activo', true),
      supabaseAdmin.from('movimientos_bancarios').select('cuenta_bancaria_id, tipo, monto'),
    ]);

    if (opsBorrador.error) throw opsBorrador.error;
    if (opsEnProceso.error) throw opsEnProceso.error;
    if (opsCompletadasHoy.error) throw opsCompletadasHoy.error;
    if (opsVencidas.error) throw opsVencidas.error;
    if (facturasPendientesResult.error) throw facturasPendientesResult.error;
    if (proyectosActivosResult.error) throw proyectosActivosResult.error;
    if (facturasCompraResult.error) throw facturasCompraResult.error;
    if (pagosCompraResult.error) throw pagosCompraResult.error;
    if (facturasVentaResult.error) throw facturasVentaResult.error;
    if (cobrosVentaResult.error) throw cobrosVentaResult.error;
    if (cajaMovimientosResult.error) throw cajaMovimientosResult.error;
    if (cuentasBancariasResult.error) throw cuentasBancariasResult.error;
    if (movimientosBancariosResult.error) throw movimientosBancariosResult.error;

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

    // ── Cuentas por pagar ────────────────────────────────────────────────────
    const pagosPorFactura = new Map<string, number[]>();
    for (const p of pagosCompraResult.data ?? []) {
      const lista = pagosPorFactura.get(p.factura_compra_id) ?? [];
      lista.push(Number(p.monto));
      pagosPorFactura.set(p.factura_compra_id, lista);
    }
    const cuentasPorPagarTodas = (facturasCompraResult.data ?? [])
      .map((f) => ({
        id: f.id,
        numeroFactura: f.numero_factura,
        proveedorNombre: f.proveedores?.razon_social ?? null,
        saldo: calcularSaldoFactura(Number(f.total), pagosPorFactura.get(f.id) ?? []),
        antiguedad: calcularAntiguedad(f.fecha_vencimiento, hoy),
      }))
      .filter((f) => f.saldo > 0.01);
    const cuentasPorPagarVencidas = cuentasPorPagarTodas.filter(
      (f) => f.antiguedad !== 'VIGENTE' && f.antiguedad !== 'SIN_VENCIMIENTO',
    );

    // ── Cuentas por cobrar ───────────────────────────────────────────────────
    const cobrosPorFactura = new Map<string, number[]>();
    for (const c of cobrosVentaResult.data ?? []) {
      const lista = cobrosPorFactura.get(c.factura_venta_id) ?? [];
      lista.push(Number(c.monto));
      cobrosPorFactura.set(c.factura_venta_id, lista);
    }
    const cuentasPorCobrarTodas = (facturasVentaResult.data ?? [])
      .map((f) => ({
        id: f.id,
        numeroFactura: f.numero_factura,
        clienteNombre: f.cliente_nombre,
        saldo: calcularSaldoFactura(Number(f.total), cobrosPorFactura.get(f.id) ?? []),
        antiguedad: calcularAntiguedad(f.fecha_vencimiento, hoy),
      }))
      .filter((f) => f.saldo > 0.01);
    const cuentasPorCobrarVencidas = cuentasPorCobrarTodas.filter(
      (f) => f.antiguedad !== 'VIGENTE' && f.antiguedad !== 'SIN_VENCIMIENTO',
    );

    // ── Tesorería ────────────────────────────────────────────────────────────
    const saldoCajaChica = calcularSaldoCaja(
      (cajaMovimientosResult.data ?? []).map((m) => ({ tipo: m.tipo, monto: Number(m.monto) })),
    );
    const cuentasConSaldo = (cuentasBancariasResult.data ?? []).map((c) => {
      const movs = (movimientosBancariosResult.data ?? [])
        .filter((m) => m.cuenta_bancaria_id === c.id)
        .map((m) => ({ tipo: m.tipo, monto: Number(m.monto) }));
      return { banco: c.banco, numeroCuenta: c.numero_cuenta, saldo: calcularSaldoCuenta(Number(c.saldo_inicial), movs) };
    });
    const saldoBancos = cuentasConSaldo.reduce((s, c) => s + c.saldo, 0);

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
        cuentasPorCobrar: {
          totalPendiente: Math.round(cuentasPorCobrarTodas.reduce((s, f) => s + f.saldo, 0) * 100) / 100,
          vencido: Math.round(cuentasPorCobrarVencidas.reduce((s, f) => s + f.saldo, 0) * 100) / 100,
          facturasVencidas: cuentasPorCobrarVencidas.slice(0, 5),
        },
        cuentasPorPagar: {
          totalPendiente: Math.round(cuentasPorPagarTodas.reduce((s, f) => s + f.saldo, 0) * 100) / 100,
          vencido: Math.round(cuentasPorPagarVencidas.reduce((s, f) => s + f.saldo, 0) * 100) / 100,
          facturasVencidas: cuentasPorPagarVencidas.slice(0, 5),
        },
        tesoreria: {
          saldoCajaChica: Math.round(saldoCajaChica * 100) / 100,
          saldoBancos: Math.round(saldoBancos * 100) / 100,
          cuentas: cuentasConSaldo,
        },
      },
    });
  } catch (e) {
    console.error('[GET /api/dashboard/kpis]', e);
    return NextResponse.json({ error: 'Error al calcular KPIs' }, { status: 500 });
  }
}
