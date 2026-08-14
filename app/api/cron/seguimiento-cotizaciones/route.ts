/**
 * GET /api/cron/seguimiento-cotizaciones — corre una vez al día (ver `crons` en
 * vercel.json). Dos cosas:
 *
 * 1. Vence: cotizaciones en ENVIADA cuya fecha_vencimiento ya pasó se marcan VENCIDA.
 * 2. Recordatorio: cotizaciones en ENVIADA sin vencer, sin recordatorio en los
 *    últimos DIAS_ENTRE_RECORDATORIOS días y con menos de MAX_RECORDATORIOS ya
 *    mandados, reciben un email de seguimiento (mismo Resend/PDF que el envío inicial).
 *
 * Autenticado con el header que Vercel Cron agrega automáticamente
 * (`Authorization: Bearer $CRON_SECRET`) — sin esto, cualquiera podría pegarle a
 * este endpoint y disparar emails a clientes reales.
 */

import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { mapCotizacionRow } from '@/lib/services/mappers';
import { leerConfiguracionSRI } from '@/lib/services/configuracion-sri.service';
import { generarCotizacionPDF } from '@/lib/services/cotizacion-pdf.service';

export const dynamic = 'force-dynamic';

const DIAS_ENTRE_RECORDATORIOS = 3;
const MAX_RECORDATORIOS = 3;

function haceMasDeXDias(fechaISO: string, dias: number): boolean {
  const limite = new Date();
  limite.setUTCDate(limite.getUTCDate() - dias);
  return new Date(fechaISO) <= limite;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const hoy = new Date().toISOString().slice(0, 10);
  const resultado = { vencidas: 0, recordatoriosEnviados: 0, errores: [] as string[] };

  try {
    // 1. Vencidas
    const { data: vencidas, error: vencidasError } = await supabaseAdmin
      .from('cotizaciones')
      .update({ estado: 'VENCIDA' })
      .eq('estado', 'ENVIADA')
      .lt('fecha_vencimiento', hoy)
      .select('id');
    if (vencidasError) throw vencidasError;
    resultado.vencidas = vencidas?.length ?? 0;

    // 2. Candidatas a recordatorio: ENVIADA, no vencidas, bajo el tope de recordatorios.
    const { data: candidatas, error: candidatasError } = await supabaseAdmin
      .from('cotizaciones')
      .select('*, cotizacion_lineas(*)')
      .eq('estado', 'ENVIADA')
      .gte('fecha_vencimiento', hoy)
      .lt('veces_recordado', MAX_RECORDATORIOS);
    if (candidatasError) throw candidatasError;

    const aRecordar = (candidatas ?? []).filter((row) => {
      const ultimaSenal = row.ultimo_seguimiento_en ?? row.creado_en;
      return haceMasDeXDias(ultimaSenal, DIAS_ENTRE_RECORDATORIOS);
    });

    if (aRecordar.length > 0) {
      const config = await leerConfiguracionSRI();
      if (!config.resendApiKey) {
        resultado.errores.push('Falta configurar el email de envío (Configuración → SRI) — no se mandó ningún recordatorio.');
      } else {
        const resend = new Resend(config.resendApiKey);
        for (const row of aRecordar) {
          const cotizacion = mapCotizacionRow(row, row.cotizacion_lineas);
          if (!cotizacion.clienteEmail) continue;
          try {
            const pdf = await generarCotizacionPDF({ cotizacion, lineas: cotizacion.lineas, emisor: config.emisor });
            await resend.emails.send({
              from: config.resendFromEmail,
              to: cotizacion.clienteEmail,
              subject: `Recordatorio — Cotización ${cotizacion.numero}`,
              text:
                `Te recordamos que la cotización ${cotizacion.numero} por USD ${cotizacion.total.toFixed(2)} ` +
                `sigue vigente hasta el ${cotizacion.fechaVencimiento}. Cualquier consulta, respondé este correo.`,
              attachments: [{ filename: `${cotizacion.numero}.pdf`, content: pdf }],
            });
            await supabaseAdmin
              .from('cotizaciones')
              .update({
                ultimo_seguimiento_en: new Date().toISOString(),
                veces_recordado: cotizacion.vecesRecordado + 1,
              })
              .eq('id', cotizacion.id);
            resultado.recordatoriosEnviados++;
          } catch (e) {
            resultado.errores.push(`${cotizacion.numero}: ${(e as Error).message}`);
          }
        }
      }
    }

    return NextResponse.json({ ok: true, ...resultado });
  } catch (e) {
    console.error('[GET /api/cron/seguimiento-cotizaciones]', e);
    return NextResponse.json({ error: 'Error en el seguimiento de cotizaciones', detalle: (e as Error).message }, { status: 500 });
  }
}
