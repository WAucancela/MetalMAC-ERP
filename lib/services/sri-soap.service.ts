/**
 * sri-soap.service.ts — recepción y autorización de comprobantes ante los web
 * services SOAP del SRI. Única pieza de Fase 2 con I/O de red hacia el SRI —
 * deliberadamente sin librería `soap`: los dos envelopes son fijos y chicos, se arman
 * a mano y se postean con `fetch`, parseando la respuesta con fast-xml-parser (ya
 * usado en el resto del repo) — mismo criterio de "sin abstracción que esconda qué
 * XML se manda" que ya sigue sri.service.ts.
 *
 * El ambiente (`SriAmbiente`) decide tanto el dígito de la clave de acceso como
 * estos endpoints — viene de la configuración guardada en Configuración → SRI /
 * Email (ver lib/services/configuracion-sri.service.ts), nunca de un default:
 * nunca se debe hablar con el ambiente de PRODUCCIÓN del SRI sin una elección
 * explícita del GERENTE.
 */

import { XMLParser } from 'fast-xml-parser';
import {
  parsearRespuestaRecepcion,
  parsearRespuestaAutorizacion,
  type RespuestaRecepcion,
  type RespuestaAutorizacion,
} from '@/lib/services/sri-emision.service';

export type SriAmbiente = 'PRUEBAS' | 'PRODUCCION';

const ENDPOINTS: Record<SriAmbiente, { recepcion: string; autorizacion: string }> = {
  PRUEBAS: {
    recepcion: 'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline',
    autorizacion: 'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline',
  },
  PRODUCCION: {
    recepcion: 'https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline',
    autorizacion: 'https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline',
  },
};

/** Dígito de ambiente (1/2) que va dentro de la clave de acceso — mismo criterio que el SRI usa en sus propios comprobantes. */
export function digitoAmbiente(ambiente: SriAmbiente): '1' | '2' {
  return ambiente === 'PRUEBAS' ? '1' : '2';
}

// parseTagValue: false — igual criterio que sri.service.ts: sin esto, fast-xml-parser
// convierte campos como numeroAutorizacion (numérico pero conceptualmente un
// identificador de texto, no una cantidad) a Number de JS, arriesgando pérdida de
// precisión en valores largos.
const soapParser = new XMLParser({ removeNSPrefix: true, ignoreAttributes: true, parseTagValue: false });

async function postSoap(url: string, envelope: string): Promise<any> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=utf-8' },
    body: envelope,
  });
  const texto = await res.text();
  if (!res.ok) {
    throw new Error(`El SRI respondió HTTP ${res.status}: ${texto.slice(0, 500)}`);
  }
  return soapParser.parse(texto);
}

/** El namespace/prefijo del <Envelope> varía según servidor — removeNSPrefix ya lo saca del nombre de la etiqueta. */
function extraerCuerpoSoap(respuestaParseada: any): any {
  return respuestaParseada?.Envelope?.Body ?? respuestaParseada;
}

/** Envía el XML firmado (recepción) — el SRI valida esquema/firma y dice si lo recibe o lo devuelve. */
export async function enviarRecepcion(
  xmlFirmadoBase64: string,
  ambiente: SriAmbiente,
): Promise<RespuestaRecepcion> {
  const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="http://ec.gob.sri.ws.recepcion">
  <soapenv:Header/>
  <soapenv:Body>
    <ec:validarComprobante>
      <xml>${xmlFirmadoBase64}</xml>
    </ec:validarComprobante>
  </soapenv:Body>
</soapenv:Envelope>`;

  const parsed = await postSoap(ENDPOINTS[ambiente].recepcion, envelope);
  const body = extraerCuerpoSoap(parsed);
  const respuesta = body?.validarComprobanteResponse ?? body;
  return parsearRespuestaRecepcion(respuesta);
}

/** Consulta el estado de autorización de una clave de acceso ya recibida. */
export async function consultarAutorizacion(
  claveAcceso: string,
  ambiente: SriAmbiente,
): Promise<RespuestaAutorizacion> {
  const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="http://ec.gob.sri.ws.autorizacion">
  <soapenv:Header/>
  <soapenv:Body>
    <ec:autorizacionComprobante>
      <claveAccesoComprobante>${claveAcceso}</claveAccesoComprobante>
    </ec:autorizacionComprobante>
  </soapenv:Body>
</soapenv:Envelope>`;

  const parsed = await postSoap(ENDPOINTS[ambiente].autorizacion, envelope);
  const body = extraerCuerpoSoap(parsed);
  const respuesta = body?.autorizacionComprobanteResponse ?? body;
  return parsearRespuestaAutorizacion(respuesta);
}

/**
 * El SRI suele tardar unos segundos entre recepción y autorización — reintenta con
 * espera fija hasta obtener un estado final (AUTORIZADO/NO_AUTORIZADO) o agotar los
 * intentos, en cuyo caso el llamador decide qué hacer con un trámite que sigue
 * EN_PROCESO (ej. marcar la factura como "enviada, pendiente de confirmar" en vez de
 * fallar directamente).
 */
export async function esperarAutorizacion(
  claveAcceso: string,
  ambiente: SriAmbiente,
  opciones: { intentos?: number; esperaMs?: number } = {},
): Promise<RespuestaAutorizacion> {
  const intentos = opciones.intentos ?? 5;
  const esperaMs = opciones.esperaMs ?? 3000;

  let ultimaRespuesta: RespuestaAutorizacion = {
    estado: 'EN_PROCESO',
    numeroAutorizacion: null,
    fechaAutorizacion: null,
    mensajes: [],
  };

  for (let i = 0; i < intentos; i++) {
    ultimaRespuesta = await consultarAutorizacion(claveAcceso, ambiente);
    if (ultimaRespuesta.estado !== 'EN_PROCESO') return ultimaRespuesta;
    await new Promise((resolve) => setTimeout(resolve, esperaMs));
  }
  return ultimaRespuesta;
}
