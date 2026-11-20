/**
 * GET /api/cron/seguimiento-leads-tienda — corre periódicamente (ver `crons` en
 * vercel.json). Avisa al equipo por email cuando un lead del sitio público
 * (tallermac-web) lleva más de HORAS_SIN_ATENDER sin que nadie lo marque como
 * contactado — para que no se enfríe por un olvido.
 *
 * Un solo aviso por fila (recordatorio_enviado_en), no reintentos escalonados como en
 * seguimiento-cotizaciones — esto es un "oye, revisa esto", no un recordatorio de pago.
 *
 * Autenticado igual que seguimiento-cotizaciones: header que Vercel Cron agrega
 * automáticamente (`Authorization: Bearer $CRON_SECRET`).
 */

import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { leerConfiguracionSRI } from '@/lib/services/configuracion-sri.service';

export const dynamic = 'force-dynamic';

const HORAS_SIN_ATENDER = 4;
const DESTINATARIO_DEFECTO = 'ventas@tallermac.com';

function haceMasDeXHoras(fechaISO: string, horas: number): boolean {
  const limite = new Date();
  limite.setUTCHours(limite.getUTCHours() - horas);
  return new Date(fechaISO) <= limite;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const resultado = { solicitudesAvisadas: 0, pedidosAvisados: 0, errores: [] as string[] };

  try {
    const config = await leerConfiguracionSRI();
    if (!config.resendApiKey) {
      return NextResponse.json({
        ok: true,
        ...resultado,
        errores: ['Falta configurar el email de envío (Configuración → SRI) — no se mandó ningún aviso.'],
      });
    }
    const resend = new Resend(config.resendApiKey);

    // ── Solicitudes de contacto sin atender ──────────────────────────────────
    const { data: solicitudes, error: solicitudesError } = await supabaseAdmin
      .from('solicitudes_contacto')
      .select('*')
      .eq('estado', 'NUEVA')
      .is('recordatorio_enviado_en', null);
    if (solicitudesError) throw solicitudesError;

    const solicitudesVencidas = (solicitudes ?? []).filter((s) => haceMasDeXHoras(s.creado_en, HORAS_SIN_ATENDER));

    for (const s of solicitudesVencidas) {
      try {
        await resend.emails.send({
          from: config.resendFromEmail,
          to: DESTINATARIO_DEFECTO,
          subject: `⏰ Lead sin atender hace +${HORAS_SIN_ATENDER}h — ${s.nombre}`,
          text:
            `La solicitud de "${s.nombre}" (${s.email}) sigue en NUEVA desde hace más de ` +
            `${HORAS_SIN_ATENDER} horas.\n\nServicio de interés: ${s.servicio_interes || '(no especificado)'}\n\n` +
            `Revísala en el ERP: /solicitudes-contacto/${s.id}`,
        });
        await supabaseAdmin
          .from('solicitudes_contacto')
          .update({ recordatorio_enviado_en: new Date().toISOString() })
          .eq('id', s.id);
        resultado.solicitudesAvisadas++;
      } catch (e) {
        resultado.errores.push(`Solicitud ${s.id}: ${(e as Error).message}`);
      }
    }

    // ── Pedidos de tienda sin atender ─────────────────────────────────────────
    const { data: pedidos, error: pedidosError } = await supabaseAdmin
      .from('pedidos_tienda')
      .select('*')
      .eq('estado', 'PENDIENTE_CONTACTO')
      .is('recordatorio_enviado_en', null);
    if (pedidosError) throw pedidosError;

    const pedidosVencidos = (pedidos ?? []).filter((p) => haceMasDeXHoras(p.creado_en, HORAS_SIN_ATENDER));

    for (const p of pedidosVencidos) {
      try {
        await resend.emails.send({
          from: config.resendFromEmail,
          to: DESTINATARIO_DEFECTO,
          subject: `⏰ Pedido de tienda sin atender hace +${HORAS_SIN_ATENDER}h — ${p.cliente_nombre}`,
          text:
            `El pedido de "${p.cliente_nombre}" (${p.cliente_email}) por $${Number(p.total).toFixed(2)} ` +
            `sigue en PENDIENTE_CONTACTO desde hace más de ${HORAS_SIN_ATENDER} horas.\n\n` +
            `Revísalo en el ERP: /pedidos-tienda/${p.id}`,
        });
        await supabaseAdmin
          .from('pedidos_tienda')
          .update({ recordatorio_enviado_en: new Date().toISOString() })
          .eq('id', p.id);
        resultado.pedidosAvisados++;
      } catch (e) {
        resultado.errores.push(`Pedido ${p.id}: ${(e as Error).message}`);
      }
    }

    return NextResponse.json({ ok: true, ...resultado });
  } catch (e) {
    console.error('[GET /api/cron/seguimiento-leads-tienda]', e);
    return NextResponse.json({ error: 'Error en el seguimiento de leads', detalle: (e as Error).message }, { status: 500 });
  }
}
