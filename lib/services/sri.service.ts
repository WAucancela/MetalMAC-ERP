/**
 * sri.service.ts — Servicio de parseo y validación de comprobantes SRI Ecuador
 *
 * Reglas críticas:
 * - La clave de acceso SRI tiene exactamente 49 dígitos numéricos
 * - El dígito verificador (posición 49) usa módulo 11 con factor que reinicia en 7
 * - IVA Ecuador vigente: 15%
 * - fast-xml-parser debe configurarse con parseAttributeValue: true e ignoreAttributes: false
 */

import { XMLParser } from 'fast-xml-parser';
import type {
  ClaveAccesoSRI,
  FacturaXMLParseada,
  ImpuestoXML,
  LineaXML,
} from '@/types/metalmac.types';

// ─────────────────────────────────────────────
// Constantes SRI
// ─────────────────────────────────────────────

const LONGITUD_CLAVE_ACCESO = 49;

/** Pesos para módulo 11, ciclando de 2 a 7 */
const PESOS_MODULO11 = [2, 3, 4, 5, 6, 7];

// ─────────────────────────────────────────────
// Errores de dominio
// ─────────────────────────────────────────────

export class ClaveAccesoInvalidaError extends Error {
  constructor(
    public readonly clave: string,
    public readonly motivo: string,
  ) {
    super(`Clave de acceso inválida [${motivo}]: "${clave}"`);
    this.name = 'ClaveAccesoInvalidaError';
  }
}

export class XMLInvalidoError extends Error {
  constructor(public readonly motivo: string) {
    super(`XML SRI inválido: ${motivo}`);
    this.name = 'XMLInvalidoError';
  }
}

// ─────────────────────────────────────────────
// validarClaveAcceso
// ─────────────────────────────────────────────

/**
 * Valida la clave de acceso SRI con módulo 11.
 *
 * Estructura de los 49 dígitos:
 *  [0-7]   fechaEmision (DDMMAAAA)
 *  [8-9]   tipoComprobante ("01" = Factura)
 *  [10-22] rucEmisor (13 dígitos)
 *  [23]    ambiente ("1" = Pruebas, "2" = Producción)
 *  [24-29] serie (establecimiento 3 + punto emisión 3)
 *  [30-38] secuencial (9 dígitos)
 *  [39-46] codigoNumerico (8 dígitos)
 *  [47]    tipoEmision ("1" = Normal)
 *  [48]    digitoVerificador (módulo 11)
 */
export function validarClaveAcceso(clave: string): ClaveAccesoSRI {
  if (clave.length !== LONGITUD_CLAVE_ACCESO) {
    throw new ClaveAccesoInvalidaError(
      clave,
      `longitud ${clave.length}, se esperan ${LONGITUD_CLAVE_ACCESO} dígitos`,
    );
  }

  if (!/^\d+$/.test(clave)) {
    throw new ClaveAccesoInvalidaError(clave, 'contiene caracteres no numéricos');
  }

  // Validar dígito verificador (módulo 11)
  const digits = clave.split('').map(Number);
  const digitoEsperado = calcularDigitoVerificador(digits.slice(0, 48));
  const digitoRecibido = digits[48];

  if (digitoEsperado !== digitoRecibido) {
    throw new ClaveAccesoInvalidaError(
      clave,
      `dígito verificador incorrecto: esperado=${digitoEsperado}, recibido=${digitoRecibido}`,
    );
  }

  const ambiente = clave[23] as '1' | '2';
  if (ambiente !== '1' && ambiente !== '2') {
    throw new ClaveAccesoInvalidaError(clave, `ambiente inválido: "${ambiente}"`);
  }

  if (clave[47] !== '1') {
    throw new ClaveAccesoInvalidaError(
      clave,
      `tipo de emisión inválido: "${clave[47]}" (solo se admite "1" = Normal)`,
    );
  }

  return {
    fechaEmision: clave.slice(0, 8),           // DDMMAAAA
    tipoComprobante: clave.slice(8, 10),        // "01"
    rucEmisor: clave.slice(10, 23),             // 13 dígitos
    ambiente,
    serie: clave.slice(24, 30),                 // 6 dígitos
    secuencial: clave.slice(30, 39),            // 9 dígitos
    codigoNumerico: clave.slice(39, 47),        // 8 dígitos
    tipoEmision: '1',
    digitoVerificador: clave[48],
  };
}

/**
 * Calcula el dígito verificador módulo 11 SRI.
 * Si el residuo es 0 → dígito = 0
 * Si el residuo es 1 → dígito = 1
 * Si el residuo es 11 → dígito = 0 (algunos SRI docs dicen 0, verificado con ejemplos reales)
 */
export function calcularDigitoVerificador(digits: number[]): number {
  let suma = 0;
  let factorIdx = 0;

  // Se recorre de derecha a izquierda
  for (let i = digits.length - 1; i >= 0; i--) {
    const peso = PESOS_MODULO11[factorIdx % PESOS_MODULO11.length];
    suma += digits[i] * peso;
    factorIdx++;
  }

  const residuo = suma % 11;

  if (residuo === 0) return 0;
  if (residuo === 1) return 1;
  return 11 - residuo;
}

// ─────────────────────────────────────────────
// parsearXML
// ─────────────────────────────────────────────

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: true,
  // false: evita que fast-xml-parser convierta valores numéricos largos (ej. claveAcceso
  // de 49 dígitos) a Number de JS, lo que pierde precisión (notación científica).
  parseTagValue: false,
  trimValues: true,
  // Los números en XML del SRI vienen como strings — los convertimos
  isArray: (name) =>
    ['detalle', 'impuesto', 'totalImpuesto', 'campoAdicional'].includes(name),
});

/**
 * Parsea el XML de una factura SRI y retorna una estructura normalizada.
 * Compatible con el formato de comprobante electrónico versión 1.0.0 y 2.0.0.
 *
 * @throws XMLInvalidoError si el XML no tiene la estructura esperada de una factura SRI
 */
export function parsearXML(xmlString: string): FacturaXMLParseada {
  let parsed: Record<string, unknown>;

  try {
    parsed = xmlParser.parse(xmlString) as Record<string, unknown>;
  } catch (e) {
    throw new XMLInvalidoError(`No se pudo parsear el XML: ${(e as Error).message}`);
  }

  // El comprobante puede venir envuelto en <comprobanteXml> (autorizado) o directo
  const root =
    (parsed['comprobanteXml'] as Record<string, unknown>) ??
    (parsed['factura'] as Record<string, unknown>) ??
    parsed;

  const facturaNode =
    (root['factura'] as Record<string, unknown>) ??
    (root as Record<string, unknown>);

  if (!facturaNode) {
    throw new XMLInvalidoError('No se encontró el nodo <factura> en el XML');
  }

  const infoTributaria = facturaNode['infoTributaria'] as Record<string, unknown> | undefined;
  const infoFactura = facturaNode['infoFactura'] as Record<string, unknown> | undefined;
  const detalles = facturaNode['detalles'] as Record<string, unknown> | undefined;

  if (!infoTributaria || !infoFactura) {
    throw new XMLInvalidoError(
      'El XML no contiene los nodos requeridos: <infoTributaria>, <infoFactura>',
    );
  }

  const claveAcceso = String(infoTributaria['claveAcceso'] ?? '');
  if (!claveAcceso) {
    throw new XMLInvalidoError('No se encontró <claveAcceso> en el XML');
  }

  // Validar la clave de acceso (lanzará ClaveAccesoInvalidaError si es inválida)
  validarClaveAcceso(claveAcceso);

  const estab = String(infoTributaria['estab'] ?? '');
  const ptoEmision = String(infoTributaria['ptoEmi'] ?? '');
  const secuencial = String(infoTributaria['secuencial'] ?? '');
  const numeroFactura = `${estab}-${ptoEmision}-${secuencial}`;

  // Parsear fecha "DD/MM/YYYY" → ISO string guardamos como string original
  const fechaEmisionRaw = String(infoFactura['fechaEmision'] ?? '');

  // Totales
  const subtotalSinIva = toNumber(infoFactura['totalSinImpuestos']);
  const totalImpuestosNode = infoFactura['totalConImpuestos'] as Record<string, unknown> | undefined;
  const totalImpuestosArr = (totalImpuestosNode?.['totalImpuesto'] as unknown[]) ?? [];

  let totalIva = 0;
  const impuestos: ImpuestoXML[] = totalImpuestosArr.map((imp) => {
    const i = imp as Record<string, unknown>;
    const obj: ImpuestoXML = {
      codigo: String(i['codigo'] ?? ''),
      codigoPorcentaje: String(i['codigoPorcentaje'] ?? ''),
      tarifa: toNumber(i['tarifa']),
      baseImponible: toNumber(i['baseImponible']),
      valor: toNumber(i['valor']),
    };
    if (obj.codigo === '2') totalIva += obj.valor; // IVA
    return obj;
  });

  const importeTotal = toNumber(infoFactura['importeTotal']);

  // Líneas de detalle
  const detalleArr = (detalles?.['detalle'] as unknown[]) ?? [];
  const lineas: LineaXML[] = detalleArr.map((det) => {
    const d = det as Record<string, unknown>;
    return {
      codigoInterno: String(d['codigoPrincipal'] ?? ''),
      codigoAdicional: String(d['codigoAuxiliar'] ?? ''),
      descripcion: String(d['descripcion'] ?? ''),
      cantidad: toNumber(d['cantidad']),
      precioUnitario: toNumber(d['precioUnitario']),
      descuento: toNumber(d['descuento']),
      precioTotalSinImpuesto: toNumber(d['precioTotalSinImpuesto']),
    };
  });

  if (lineas.length === 0) {
    throw new XMLInvalidoError('La factura no tiene líneas de detalle');
  }

  return {
    claveAcceso,
    numeroFactura,
    rucEmisor: String(infoTributaria['ruc'] ?? ''),
    razonSocialEmisor: String(infoTributaria['razonSocial'] ?? ''),
    fechaEmision: fechaEmisionRaw,
    subtotalSinIva,
    totalIva,
    importeTotal,
    lineas,
    impuestos,
  };
}

// ─────────────────────────────────────────────
// Helpers internos
// ─────────────────────────────────────────────

function toNumber(val: unknown): number {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

/**
 * Convierte la fecha SRI "DD/MM/YYYY" al formato ISO "YYYY-MM-DD".
 * Exportada para uso en tests y en los route handlers.
 */
export function fechaSRIaISO(fechaSRI: string): string {
  const [dd, mm, yyyy] = fechaSRI.split('/');
  if (!dd || !mm || !yyyy) return fechaSRI; // Si ya es ISO, devolverla tal cual
  return `${yyyy}-${mm}-${dd}`;
}
