/**
 * GET /api/dashboard/kpis
 *
 * Agrega en paralelo los KPIs de los 4 módulos:
 *   - inventario:    materiales bajo stock mínimo
 *   - produccion:    OPs por estado, completadas hoy
 *   - contabilidad:  facturas pendientes (RECIBIDA), monto total pendiente
 *   - proyectos:     proyectos activos, presupuesto vs ejecutado
 */

import { NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { getAuthenticatedUser } from '@/app/api/_helpers';

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setDate(hoy.getDate() + 1);

    const [
      stockSnap,
      opsBorradorSnap,
      opsEnProcesoSnap,
      opsCompletadasHoySnap,
      facturasPendientesSnap,
      proyectosActivosSnap,
    ] = await Promise.all([
      adminDb.collection('stock').limit(500).get(),
      adminDb.collection('ordenes_produccion').where('estado', '==', 'BORRADOR').get(),
      adminDb.collection('ordenes_produccion').where('estado', '==', 'EN_PROCESO').get(),
      adminDb.collection('ordenes_produccion')
        .where('estado', '==', 'COMPLETADA')
        .where('fechaCompletada', '>=', Timestamp.fromDate(hoy))
        .where('fechaCompletada', '<',  Timestamp.fromDate(manana))
        .get(),
      adminDb.collection('facturas_compra')
        .where('estado', '==', 'PENDIENTE')
        .orderBy('fechaEmision', 'desc')
        .limit(200)
        .get(),
      adminDb.collection('proyectos').where('estado', '==', 'ACTIVO').get(),
    ]);

    // ── Inventario ────────────────────────────────────────────────────────────
    const stockItems = stockSnap.docs.map((d) => d.data());
    const materialIdsConPocaStock = stockItems
      .filter((s: any) => (s.cantidadDisponible ?? 0) <= (s.stockMinimo ?? 0))
      .map((s: any) => s.materialId)
      .filter(Boolean);

    // ── Producción ────────────────────────────────────────────────────────────
    const opsVencidas = [
      ...opsBorradorSnap.docs,
      ...opsEnProcesoSnap.docs,
    ].filter((d) => {
      const fe = d.data().fechaEntrega;
      if (!fe) return false;
      const fecha = fe.seconds ? new Date(fe.seconds * 1000) : new Date(fe);
      return fecha < hoy;
    }).length;

    // ── Contabilidad ──────────────────────────────────────────────────────────
    const facturasPendientes = facturasPendientesSnap.docs.map((d) => d.data());
    const montoPendiente = facturasPendientes.reduce(
      (acc: number, f: any) => acc + (f.importeTotal ?? 0), 0,
    );
    const facturasUltimas5 = facturasPendientesSnap.docs.slice(0, 5).map((d) => ({
      id: d.id,
      numeroFactura: d.data().numeroFactura,
      razonSocialEmisor: d.data().razonSocialEmisor,
      importeTotal: d.data().importeTotal,
    }));

    // ── Proyectos ─────────────────────────────────────────────────────────────
    const proyectosActivos = proyectosActivosSnap.docs.map((d) => ({
      id: d.id,
      codigo: d.data().codigo,
      nombre: d.data().nombre,
      cliente: d.data().cliente,
      presupuesto: d.data().presupuesto ?? 0,
      costoReal: d.data().costoReal ?? 0,
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
          materialesBajoStock: materialIdsConPocaStock.length,
          materialIdsAlerta: materialIdsConPocaStock.slice(0, 10),
        },
        produccion: {
          opsBorrador:       opsBorradorSnap.size,
          opsEnProceso:      opsEnProcesoSnap.size,
          opsCompletadasHoy: opsCompletadasHoySnap.size,
          opsVencidas,
          totalActivas:      opsBorradorSnap.size + opsEnProcesoSnap.size,
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
