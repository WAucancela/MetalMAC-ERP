/**
 * reportes.service.ts — agregaciones puras para app/api/reportes/* que
 * necesitan algo más que un SELECT directo. Sin I/O — testeable directo,
 * igual que woocommerce.service.ts / whatsapp-historial.ts.
 */

export type EstadoCotizacionReporte = 'BORRADOR' | 'ENVIADA' | 'APROBADA' | 'RECHAZADA' | 'VENCIDA';
export type OrigenCotizacion = 'STAFF' | 'WHATSAPP_BOT';

export interface CotizacionParaResumen {
  origen: OrigenCotizacion;
  estado: EstadoCotizacionReporte;
  total: number;
}

export interface ResumenCotizacionesPorOrigen {
  origen: OrigenCotizacion;
  totalCotizaciones: number;
  montoTotal: number;
  porEstado: Record<EstadoCotizacionReporte, number>;
  montoAprobado: number;
  // Aprobadas / (total - las que todavía están en BORRADOR, sin decisión
  // tomada) — null si no hay ninguna cotización fuera de BORRADOR todavía
  // (dividir por cero no es "0% de aprobación", es "no hay dato").
  tasaAprobacion: number | null;
}

const ESTADOS: EstadoCotizacionReporte[] = ['BORRADOR', 'ENVIADA', 'APROBADA', 'RECHAZADA', 'VENCIDA'];
const ORIGENES: OrigenCotizacion[] = ['STAFF', 'WHATSAPP_BOT'];

export function calcularResumenCotizacionesPorOrigen(
  cotizaciones: CotizacionParaResumen[],
): ResumenCotizacionesPorOrigen[] {
  return ORIGENES.map((origen) => {
    const delOrigen = cotizaciones.filter((c) => c.origen === origen);

    const porEstado = ESTADOS.reduce((acc, estado) => {
      acc[estado] = delOrigen.filter((c) => c.estado === estado).length;
      return acc;
    }, {} as Record<EstadoCotizacionReporte, number>);

    const montoTotal = Math.round(delOrigen.reduce((acc, c) => acc + c.total, 0) * 100) / 100;
    const aprobadas = delOrigen.filter((c) => c.estado === 'APROBADA');
    const montoAprobado = Math.round(aprobadas.reduce((acc, c) => acc + c.total, 0) * 100) / 100;

    const decididas = delOrigen.length - porEstado.BORRADOR;
    const tasaAprobacion = decididas > 0 ? aprobadas.length / decididas : null;

    return {
      origen,
      totalCotizaciones: delOrigen.length,
      montoTotal,
      porEstado,
      montoAprobado,
      tasaAprobacion,
    };
  });
}
