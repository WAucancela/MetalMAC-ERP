/**
 * GET /api/reportes/cotizaciones-por-origen
 * Compara cotizaciones armadas a mano por el staff vs. las que armó solo el
 * agente de WhatsApp (`cotizaciones.origen`) — cuántas, cuánto $, y qué tasa
 * de aprobación tiene cada canal.
 *
 * Query params:
 *   desde=YYYY-MM-DD (opcional, default: hace 30 días)
 *   hasta=YYYY-MM-DD (opcional, default: hoy)
 *   format=csv (default) | json
 */
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getAuthenticatedUser } from '@/app/api/_helpers';
import { calcularResumenCotizacionesPorOrigen } from '@/lib/services/reportes.service';

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

function hace30DiasISO(): string {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const ORIGEN_LABEL: Record<string, string> = { STAFF: 'Staff', WHATSAPP_BOT: 'Agente de WhatsApp' };

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const desde = searchParams.get('desde') ?? hace30DiasISO();
  const hasta = searchParams.get('hasta') ?? new Date().toISOString().slice(0, 10);
  const format = searchParams.get('format') ?? 'csv';

  try {
    const { data, error } = await supabaseAdmin
      .from('cotizaciones')
      .select('origen, estado, total, fecha_emision')
      .gte('fecha_emision', desde)
      .lte('fecha_emision', hasta);
    if (error) throw error;

    const resumen = calcularResumenCotizacionesPorOrigen(
      (data ?? []).map((c) => ({
        origen: c.origen as 'STAFF' | 'WHATSAPP_BOT',
        estado: c.estado,
        total: Number(c.total),
      })),
    );

    if (format === 'json') {
      return NextResponse.json({ ok: true, data: resumen, desde, hasta, generadoEn: new Date().toISOString() });
    }

    const header =
      'Origen,Cotizaciones,Monto Total USD,Borrador,Enviada,Aprobada,Rechazada,Vencida,Monto Aprobado USD,Tasa de Aprobación\n';
    const csvRows = resumen.map((r) =>
      rowToCsv([
        ORIGEN_LABEL[r.origen] ?? r.origen,
        r.totalCotizaciones,
        r.montoTotal.toFixed(2),
        r.porEstado.BORRADOR,
        r.porEstado.ENVIADA,
        r.porEstado.APROBADA,
        r.porEstado.RECHAZADA,
        r.porEstado.VENCIDA,
        r.montoAprobado.toFixed(2),
        r.tasaAprobacion === null ? 'N/A' : `${(r.tasaAprobacion * 100).toFixed(1)}%`,
      ]),
    );
    const csv = header + csvRows.join('\n') + '\n';

    const generadoEl = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="cotizaciones_por_origen_${desde}_${hasta}_${generadoEl}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    console.error('[GET /api/reportes/cotizaciones-por-origen]', e);
    return NextResponse.json({ error: 'Error al generar reporte' }, { status: 500 });
  }
}
