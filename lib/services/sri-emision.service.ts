/**
 * sri-emision.service.ts — lógica pura para emitir un comprobante de venta ante el SRI
 * (Fase 2). Sin I/O — ni firma, ni red, ni base de datos — testeable directamente,
 * igual criterio que sri.service.ts.
 *
 * IMPORTANTE: el XML que genera `generarXMLFactura` cubre los campos obligatorios más
 * comunes de la ficha técnica de factura del SRI, pero NO se validó todavía contra el
 * XSD oficial completo. Antes de emitir contra el ambiente de PRODUCCIÓN del SRI hay
 * que probar el flujo completo contra el ambiente de PRUEBAS con facturas reales y
 * revisar la respuesta de autorización a mano (ver plan de Fase 2).
 */

import { calcularDigitoVerificador } from '@/lib/services/sri.service';
import type { FacturaVenta, LineaFacturaVenta } from '@/types/metalmac.types';

// ─────────────────────────────────────────────
// Datos del emisor (el taller) — no hay tabla de configuración todavía, se pasan
// como parámetro (nunca hardcodeados acá) para mantener esta función pura.
// ─────────────────────────────────────────────

export interface EmisorConfig {
  ruc: string;
  razonSocial: string;
  nombreComercial: string;
  dirMatriz: string;
  dirEstablecimiento: string;
  obligadoContabilidad: 'SI' | 'NO';
  contribuyenteEspecial?: string; // número de resolución, si aplica — opcional
}

// ─────────────────────────────────────────────
// generarClaveAcceso
// ─────────────────────────────────────────────

export interface GenerarClaveAccesoInput {
  fechaEmisionISO: string;   // YYYY-MM-DD
  rucEmisor: string;         // 13 dígitos
  ambiente: '1' | '2';       // 1 = Pruebas, 2 = Producción
  establecimiento: string;   // 3 dígitos, ej. "001"
  puntoEmision: string;      // 3 dígitos, ej. "001"
  secuencial: number;        // se rellena a 9 dígitos
  codigoNumerico: string;    // 8 dígitos (aleatorio, provisto por el llamador)
}

/**
 * Arma la clave de acceso de 49 dígitos con la misma estructura que ya valida
 * `validarClaveAcceso` (sri.service.ts) — el dígito verificador se calcula con la
 * función módulo 11 ya existente, reutilizada tal cual, no reimplementada.
 */
export function generarClaveAcceso(input: GenerarClaveAccesoInput): string {
  const [yyyy, mm, dd] = input.fechaEmisionISO.split('-');
  if (!yyyy || !mm || !dd) {
    throw new Error(`fechaEmisionISO inválida (se espera YYYY-MM-DD): "${input.fechaEmisionISO}"`);
  }
  const fechaEmisionDDMMAAAA = `${dd}${mm}${yyyy}`;
  const tipoComprobante = '01'; // Factura
  const serie = `${input.establecimiento.padStart(3, '0')}${input.puntoEmision.padStart(3, '0')}`;
  const secuencialStr = String(input.secuencial).padStart(9, '0');
  const tipoEmision = '1'; // Normal

  const datos48 =
    fechaEmisionDDMMAAAA +
    tipoComprobante +
    input.rucEmisor +
    input.ambiente +
    serie +
    secuencialStr +
    input.codigoNumerico.padStart(8, '0') +
    tipoEmision;

  if (datos48.length !== 48) {
    throw new Error(`Clave de acceso: longitud de datos inesperada (${datos48.length}, se esperan 48)`);
  }

  const digitos = datos48.split('').map(Number);
  const digitoVerificador = calcularDigitoVerificador(digitos);
  return datos48 + String(digitoVerificador);
}

/** Código numérico aleatorio de 8 dígitos exigido por la clave de acceso del SRI. */
export function generarCodigoNumerico(): string {
  return String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
}

// ─────────────────────────────────────────────
// generarXMLFactura
// ─────────────────────────────────────────────

const IVA_TARIFA_PORCENTAJE = '4'; // código SRI para IVA 15%
const IVA_TARIFA = 15;

function escaparXML(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function fechaISOaSRI(fechaISO: string): string {
  const [yyyy, mm, dd] = fechaISO.split('-');
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Genera el XML del comprobante (factura, tipo "01") en el mismo formato que
 * `parsearXML` (sri.service.ts) ya sabe leer — la simetría entre ambas funciones es
 * justamente la validación: lo que acá se genera, del otro lado ya está probado que
 * se puede volver a parsear con los mismos datos (ver test de round-trip).
 */
export function generarXMLFactura(
  factura: Pick<FacturaVenta, 'clienteNombre' | 'clienteRuc' | 'fechaEmision' | 'subtotalSinIva' | 'iva' | 'total'>,
  lineas: LineaFacturaVenta[],
  claveAcceso: string,
  establecimiento: string,
  puntoEmision: string,
  secuencial: number,
  emisor: EmisorConfig,
): string {
  if (lineas.length === 0) throw new Error('No se puede generar el XML de una factura sin líneas');

  const secuencialStr = String(secuencial).padStart(9, '0');
  const tipoIdentificacionComprador = factura.clienteRuc.length === 13 ? '04' : '05'; // 04=RUC, 05=Cédula

  const detalles = lineas
    .map((l, i) => {
      const precioTotalSinImpuesto = (l.cantidad * l.precioUnitario).toFixed(2);
      // Las líneas de factura de venta no llevan SKU propio (a diferencia de las de
      // compra, que sí tienen codigoProveedor) — codigoPrincipal es obligatorio en el
      // esquema del SRI así que se genera uno secuencial por línea.
      const codigoPrincipal = `ITEM${String(i + 1).padStart(3, '0')}`;
      return `
    <detalle>
      <codigoPrincipal>${codigoPrincipal}</codigoPrincipal>
      <descripcion>${escaparXML(l.descripcion)}</descripcion>
      <cantidad>${l.cantidad}</cantidad>
      <precioUnitario>${l.precioUnitario.toFixed(6)}</precioUnitario>
      <descuento>0.00</descuento>
      <precioTotalSinImpuesto>${precioTotalSinImpuesto}</precioTotalSinImpuesto>
      <impuestos>
        <impuesto>
          <codigo>2</codigo>
          <codigoPorcentaje>${IVA_TARIFA_PORCENTAJE}</codigoPorcentaje>
          <tarifa>${IVA_TARIFA}</tarifa>
          <baseImponible>${precioTotalSinImpuesto}</baseImponible>
          <valor>${(l.cantidad * l.precioUnitario * (IVA_TARIFA / 100)).toFixed(2)}</valor>
        </impuesto>
      </impuestos>
    </detalle>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<factura id="comprobante" version="1.1.0">
  <infoTributaria>
    <ambiente>${claveAcceso[23]}</ambiente>
    <tipoEmision>1</tipoEmision>
    <razonSocial>${escaparXML(emisor.razonSocial)}</razonSocial>
    <nombreComercial>${escaparXML(emisor.nombreComercial)}</nombreComercial>
    <ruc>${emisor.ruc}</ruc>
    <claveAcceso>${claveAcceso}</claveAcceso>
    <codDoc>01</codDoc>
    <estab>${establecimiento.padStart(3, '0')}</estab>
    <ptoEmi>${puntoEmision.padStart(3, '0')}</ptoEmi>
    <secuencial>${secuencialStr}</secuencial>
    <dirMatriz>${escaparXML(emisor.dirMatriz)}</dirMatriz>
    ${emisor.contribuyenteEspecial ? `<contribuyenteEspecial>${escaparXML(emisor.contribuyenteEspecial)}</contribuyenteEspecial>` : ''}
  </infoTributaria>
  <infoFactura>
    <fechaEmision>${fechaISOaSRI(factura.fechaEmision)}</fechaEmision>
    <dirEstablecimiento>${escaparXML(emisor.dirEstablecimiento)}</dirEstablecimiento>
    <obligadoContabilidad>${emisor.obligadoContabilidad}</obligadoContabilidad>
    <tipoIdentificacionComprador>${tipoIdentificacionComprador}</tipoIdentificacionComprador>
    <razonSocialComprador>${escaparXML(factura.clienteNombre)}</razonSocialComprador>
    <identificacionComprador>${factura.clienteRuc}</identificacionComprador>
    <totalSinImpuestos>${factura.subtotalSinIva.toFixed(2)}</totalSinImpuestos>
    <totalDescuento>0.00</totalDescuento>
    <totalConImpuestos>
      <totalImpuesto>
        <codigo>2</codigo>
        <codigoPorcentaje>${IVA_TARIFA_PORCENTAJE}</codigoPorcentaje>
        <baseImponible>${factura.subtotalSinIva.toFixed(2)}</baseImponible>
        <valor>${factura.iva.toFixed(2)}</valor>
      </totalImpuesto>
    </totalConImpuestos>
    <propina>0.00</propina>
    <importeTotal>${factura.total.toFixed(2)}</importeTotal>
    <moneda>DOLAR</moneda>
  </infoFactura>
  <detalles>${detalles}
  </detalles>
</factura>`;
}

// ─────────────────────────────────────────────
// Respuestas SOAP del SRI
// ─────────────────────────────────────────────

export interface RespuestaRecepcion {
  estado: 'RECIBIDA' | 'DEVUELTA';
  mensajes: string[];
}

/**
 * Interpreta la respuesta de `validarComprobante` (recepción). El SRI devuelve
 * <estado>RECIBIDA</estado> si el XML pasó las validaciones de esquema/firma, o
 * DEVUELTA con <mensajes> si lo rechazó antes de intentar autorizarlo.
 */
export function parsearRespuestaRecepcion(respuesta: {
  RespuestaRecepcionComprobante?: {
    estado?: string;
    comprobantes?: { comprobante?: { mensajes?: { mensaje?: unknown } } };
  };
}): RespuestaRecepcion {
  const raiz = respuesta.RespuestaRecepcionComprobante;
  const estado = raiz?.estado === 'RECIBIDA' ? 'RECIBIDA' : 'DEVUELTA';

  const mensajesRaw = raiz?.comprobantes?.comprobante?.mensajes?.mensaje;
  const mensajes = extraerMensajes(mensajesRaw);

  return { estado, mensajes };
}

export interface RespuestaAutorizacion {
  estado: 'AUTORIZADO' | 'NO_AUTORIZADO' | 'EN_PROCESO';
  numeroAutorizacion: string | null;
  fechaAutorizacion: string | null;
  mensajes: string[];
}

/** Interpreta la respuesta de `autorizacionComprobante`. */
export function parsearRespuestaAutorizacion(respuesta: {
  RespuestaAutorizacionComprobante?: {
    autorizaciones?: {
      autorizacion?: {
        estado?: string;
        numeroAutorizacion?: string;
        fechaAutorizacion?: string;
        mensajes?: { mensaje?: unknown };
      };
    };
  };
}): RespuestaAutorizacion {
  const autorizacion = respuesta.RespuestaAutorizacionComprobante?.autorizaciones?.autorizacion;
  const estadoRaw = autorizacion?.estado;

  const estado: RespuestaAutorizacion['estado'] =
    estadoRaw === 'AUTORIZADO' ? 'AUTORIZADO' :
    estadoRaw === 'NO AUTORIZADO' ? 'NO_AUTORIZADO' :
    'EN_PROCESO';

  return {
    estado,
    numeroAutorizacion: autorizacion?.numeroAutorizacion ?? null,
    fechaAutorizacion: autorizacion?.fechaAutorizacion ?? null,
    mensajes: extraerMensajes(autorizacion?.mensajes?.mensaje),
  };
}

/** El SRI devuelve un objeto único o un array según haya 1 o varios mensajes — normaliza a array de texto. */
function extraerMensajes(mensajeRaw: unknown): string[] {
  if (!mensajeRaw) return [];
  const arr = Array.isArray(mensajeRaw) ? mensajeRaw : [mensajeRaw];
  return arr.map((m: any) => {
    const identificador = m?.identificador ?? '';
    const mensaje = m?.mensaje ?? '';
    const infoAdicional = m?.informacionAdicional ? ` — ${m.informacionAdicional}` : '';
    return `[${identificador}] ${mensaje}${infoAdicional}`.trim();
  });
}
