/**
 * GET /api/cotizaciones/[id]/pdf — descarga el PDF de la cotización (cualquier
 * estado, incluido BORRADOR — para revisar antes de mandarla, o imprimirla para
 * un cliente que prefiere copia física en vez de email).
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getAuthenticatedUser } from '@/app/api/_helpers';
import { mapCotizacionRow } from '@/lib/services/mappers';
import { leerConfiguracionSRI } from '@/lib/services/configuracion-sri.service';
import { generarCotizacionPDF } from '@/lib/services/cotizacion-pdf.service';

export const dynamic = 'force-dynamic';

interface RouteParams { params: { id: string } }

export async function GET(request: Request, { params }: RouteParams) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const { data: row, error } = await supabaseAdmin
      .from('cotizaciones')
      .select('*, cotizacion_lineas(*)')
      .eq('id', params.id)
      .maybeSingle();
    if (error) throw error;
    if (!row) return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });

    const cotizacion = mapCotizacionRow(row, row.cotizacion_lineas);
    const { emisor } = await leerConfiguracionSRI();
    const pdf = await generarCotizacionPDF({ cotizacion, lineas: cotizacion.lineas, emisor });

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${cotizacion.numero}.pdf"`,
      },
    });
  } catch (e) {
    console.error(`[GET /api/cotizaciones/${params.id}/pdf]`, e);
    return NextResponse.json({ error: 'Error al generar el PDF' }, { status: 500 });
  }
}
