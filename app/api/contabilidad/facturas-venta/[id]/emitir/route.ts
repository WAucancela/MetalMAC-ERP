/**
 * POST /api/contabilidad/facturas-venta/[id]/emitir — Fase 2: emisión electrónica
 * real ante el SRI (genera XML → firma XAdES-BES → recepción → autorización → RIDE
 * → email). Solo se puede llamar sobre una factura en BORRADOR.
 *
 * Todo lo requerido (ambiente, datos del emisor, email de Resend — configurados
 * en Configuración → SRI / Email; el certificado .p12 activo cargado desde
 * Configuración → Certificado de firma) se lee y valida ANTES de tocar la
 * factura o el SRI — si falta algo se corta con un 500 claro, nunca a mitad de
 * camino.
 *
 * El secuencial/clave de acceso se graban en la factura ANTES de llamar al SRI: si la
 * llamada de red falla a mitad de camino, no queremos que un reintento manual vuelva
 * a pedir un secuencial nuevo mientras el anterior sigue "vivo" sin saberlo.
 */

import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getAuthenticatedUser, canWrite } from '@/app/api/_helpers';
import { mapFacturaVentaRow } from '@/lib/services/mappers';
import {
  generarClaveAcceso,
  generarCodigoNumerico,
  generarXMLFactura,
  type EmisorConfig,
} from '@/lib/services/sri-emision.service';
import { extraerCertificado, firmarXML } from '@/lib/services/sri-firma.service';
import { cargarCertificadoActivo } from '@/lib/services/certificado.service';
import { leerConfiguracionSRI } from '@/lib/services/configuracion-sri.service';
import {
  digitoAmbiente,
  enviarRecepcion,
  esperarAutorizacion,
  type SriAmbiente,
} from '@/lib/services/sri-soap.service';
import { generarRidePDF } from '@/lib/services/ride.service';

// Nunca cachear: cada respuesta depende del usuario autenticado y de datos que cambian por request.
export const dynamic = 'force-dynamic';

interface RouteParams { params: { id: string } }

export async function POST(request: Request, { params }: RouteParams) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ error: 'Sin permiso de escritura' }, { status: 403 });

  let ambiente: SriAmbiente;
  let emisor: EmisorConfig;
  let resendApiKey: string | null;
  let resendFromEmail: string;
  let p12Base64: string;
  let p12Password: string;
  try {
    const config = await leerConfiguracionSRI();
    ambiente = config.ambiente;
    emisor = config.emisor;
    resendApiKey = config.resendApiKey;
    resendFromEmail = config.resendFromEmail;

    const certificado = await cargarCertificadoActivo();
    if (!certificado) {
      throw new Error('Falta configurar el certificado de firma — subilo en Configuración → Certificado de firma');
    }
    p12Base64 = certificado.p12Base64;
    p12Password = certificado.password;
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  try {
    const { data: facturaRow, error: fetchError } = await supabaseAdmin
      .from('facturas_venta')
      .select('*, factura_venta_lineas(*)')
      .eq('id', params.id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!facturaRow) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });
    if (facturaRow.estado !== 'BORRADOR') {
      return NextResponse.json(
        { error: 'Solo se puede emitir electrónicamente una factura que esté en borrador' },
        { status: 409 },
      );
    }

    const factura = mapFacturaVentaRow(facturaRow, facturaRow.factura_venta_lineas);
    if (factura.lineas.length === 0) {
      return NextResponse.json({ error: 'La factura no tiene líneas' }, { status: 422 });
    }

    // 1. Secuencial (con lock, ver migración) + clave de acceso
    const { data: secuencial, error: secError } = await supabaseAdmin.rpc('siguiente_secuencial_factura_venta', {
      p_establecimiento: factura.establecimiento,
      p_punto_emision: factura.puntoEmision,
    });
    if (secError) throw secError;

    const claveAcceso = generarClaveAcceso({
      fechaEmisionISO: factura.fechaEmision,
      rucEmisor: emisor.ruc,
      ambiente: digitoAmbiente(ambiente),
      establecimiento: factura.establecimiento,
      puntoEmision: factura.puntoEmision,
      secuencial,
      codigoNumerico: generarCodigoNumerico(),
    });
    const numeroFactura = `${factura.establecimiento}-${factura.puntoEmision}-${String(secuencial).padStart(9, '0')}`;

    // 2. XML + firma XAdES-BES
    const xmlSinFirmar = generarXMLFactura(
      factura, factura.lineas, claveAcceso, factura.establecimiento, factura.puntoEmision, secuencial, emisor,
    );
    const certificado = await extraerCertificado(p12Base64, p12Password);
    const xmlFirmado = await firmarXML(xmlSinFirmar, certificado);

    // Se graba el secuencial/clave ANTES de hablar con el SRI (ver comentario del archivo).
    await supabaseAdmin
      .from('facturas_venta')
      .update({ clave_acceso: claveAcceso, numero_factura: numeroFactura, secuencial, sri_estado: 'PENDIENTE_ENVIO' })
      .eq('id', params.id);

    // 3. Recepción
    const xmlFirmadoBase64 = Buffer.from(xmlFirmado, 'utf8').toString('base64');
    const recepcion = await enviarRecepcion(xmlFirmadoBase64, ambiente);

    if (recepcion.estado !== 'RECIBIDA') {
      await supabaseAdmin
        .from('facturas_venta')
        .update({
          sri_estado: 'DEVUELTO',
          sri_mensaje: recepcion.mensajes.join(' | ') || 'El SRI devolvió el comprobante sin detalle',
        })
        .eq('id', params.id);
      return NextResponse.json(
        { error: 'El SRI devolvió el comprobante', detalles: recepcion.mensajes },
        { status: 422 },
      );
    }

    await supabaseAdmin.from('facturas_venta').update({ sri_estado: 'RECIBIDO' }).eq('id', params.id);

    // 4. Autorización (reintenta unos segundos — ver esperarAutorizacion)
    const autorizacion = await esperarAutorizacion(claveAcceso, ambiente);

    if (autorizacion.estado !== 'AUTORIZADO') {
      await supabaseAdmin
        .from('facturas_venta')
        .update({
          sri_estado: autorizacion.estado === 'NO_AUTORIZADO' ? 'RECHAZADO' : 'RECIBIDO',
          sri_mensaje: autorizacion.mensajes.join(' | '),
        })
        .eq('id', params.id);

      // EN_PROCESO: el SRI todavía no resolvió — no es un error, hay que consultar de
      // nuevo más tarde (por ahora manual, re-emitiendo; automatizar el reintento
      // queda para un siguiente incremento).
      if (autorizacion.estado === 'EN_PROCESO') {
        return NextResponse.json(
          { ok: true, sriEstado: 'EN_PROCESO', mensaje: 'El SRI todavía no autorizó el comprobante — probá consultar de nuevo en unos minutos.' },
          { status: 202 },
        );
      }
      return NextResponse.json(
        { error: 'El SRI no autorizó el comprobante', detalles: autorizacion.mensajes },
        { status: 422 },
      );
    }

    // 5. Autorizado — factura pasa a EMITIDA
    await supabaseAdmin
      .from('facturas_venta')
      .update({ estado: 'EMITIDA', sri_estado: 'AUTORIZADO', sri_mensaje: '' })
      .eq('id', params.id);

    // 6. RIDE + email — un fallo acá NO hace fallar la respuesta: la factura ya quedó
    // autorizada ante el SRI, que es lo que legalmente importa. El envío de mail se
    // puede reintentar aparte si hace falta.
    let emailEnviado = false;
    try {
      const ridePdf = await generarRidePDF({
        factura,
        lineas: factura.lineas,
        emisor,
        fechaAutorizacion: autorizacion.fechaAutorizacion ?? new Date().toISOString(),
        ambiente,
      });

      if (resendApiKey && factura.clienteEmail) {
        const resend = new Resend(resendApiKey);
        await resend.emails.send({
          from: resendFromEmail,
          to: factura.clienteEmail,
          subject: `Factura electrónica ${numeroFactura}`,
          text: `Adjuntamos la factura electrónica ${numeroFactura} por un total de USD ${factura.total.toFixed(2)}.`,
          attachments: [{ filename: `${numeroFactura}.pdf`, content: ridePdf }],
        });
        emailEnviado = true;
        await supabaseAdmin
          .from('facturas_venta')
          .update({ email_enviado_en: new Date().toISOString() })
          .eq('id', params.id);
      }
    } catch (e) {
      console.error(`[POST /emitir] factura ${params.id} autorizada pero el email/RIDE falló`, e);
    }

    return NextResponse.json({
      ok: true,
      claveAcceso,
      numeroFactura,
      numeroAutorizacion: autorizacion.numeroAutorizacion,
      emailEnviado,
      ambiente,
    });
  } catch (e) {
    console.error(`[POST /api/contabilidad/facturas-venta/${params.id}/emitir]`, e);
    return NextResponse.json(
      { error: 'Error al emitir la factura electrónicamente', detalle: (e as Error).message },
      { status: 500 },
    );
  }
}
