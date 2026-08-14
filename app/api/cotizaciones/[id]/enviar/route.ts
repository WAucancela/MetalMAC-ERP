/**
 * POST /api/cotizaciones/[id]/enviar — genera el PDF y lo manda por email al
 * cliente, pasando la cotización de BORRADOR a ENVIADA. Reusa exactamente la
 * misma config de Resend que ya usa la emisión de facturas (Configuración → SRI),
 * no hay una config de email separada para esto.
 */

import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getAuthenticatedUser, canWrite, puedeGestionarFinanzas } from '@/app/api/_helpers';
import { mapCotizacionRow } from '@/lib/services/mappers';
import { leerConfiguracionSRI } from '@/lib/services/configuracion-sri.service';
import { generarCotizacionPDF } from '@/lib/services/cotizacion-pdf.service';

// Nunca cachear: cada respuesta depende del usuario autenticado y de datos que cambian por request.
export const dynamic = 'force-dynamic';

interface RouteParams { params: { id: string } }

export async function POST(request: Request, { params }: RouteParams) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canWrite(user) && !puedeGestionarFinanzas(user)) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
  }

  try {
    const { data: row, error: fetchError } = await supabaseAdmin
      .from('cotizaciones')
      .select('*, cotizacion_lineas(*)')
      .eq('id', params.id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!row) return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });
    if (row.estado !== 'BORRADOR') {
      return NextResponse.json({ error: 'Solo se puede enviar una cotización que esté en borrador' }, { status: 409 });
    }

    const cotizacion = mapCotizacionRow(row, row.cotizacion_lineas);
    if (!cotizacion.clienteEmail) {
      return NextResponse.json({ error: 'La cotización no tiene email de cliente cargado' }, { status: 422 });
    }
    if (cotizacion.lineas.length === 0) {
      return NextResponse.json({ error: 'La cotización no tiene líneas' }, { status: 422 });
    }

    const config = await leerConfiguracionSRI();
    if (!config.resendApiKey) {
      return NextResponse.json(
        { error: 'Falta configurar el email de envío — Configuración → SRI' },
        { status: 500 },
      );
    }

    const pdf = await generarCotizacionPDF({ cotizacion, lineas: cotizacion.lineas, emisor: config.emisor });

    const resend = new Resend(config.resendApiKey);
    await resend.emails.send({
      from: config.resendFromEmail,
      to: cotizacion.clienteEmail,
      subject: `Cotización ${cotizacion.numero}`,
      text:
        `Adjuntamos la cotización ${cotizacion.numero} por un total de USD ${cotizacion.total.toFixed(2)}, ` +
        `válida hasta el ${cotizacion.fechaVencimiento}.`,
      attachments: [{ filename: `${cotizacion.numero}.pdf`, content: pdf }],
    });

    const ahora = new Date().toISOString();
    const { error: updError } = await supabaseAdmin
      .from('cotizaciones')
      .update({ estado: 'ENVIADA', email_enviado_en: ahora, ultimo_seguimiento_en: ahora })
      .eq('id', params.id);
    if (updError) throw updError;

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(`[POST /api/cotizaciones/${params.id}/enviar]`, e);
    return NextResponse.json({ error: 'Error al enviar la cotización', detalle: (e as Error).message }, { status: 500 });
  }
}
