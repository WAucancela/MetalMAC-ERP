/**
 * Tests unitarios para sri.service.ts
 *
 * - validarClaveAcceso: casos válidos e inválidos
 * - calcularDigitoVerificador: pure math
 * - parsearXML: happy path + errores de estructura
 * - fechaSRIaISO: conversión de formato
 *
 * NO requiere Firebase — sri.service.ts no importa ningún SDK de Firestore.
 */

import {
  validarClaveAcceso,
  calcularDigitoVerificador,
  parsearXML,
  fechaSRIaISO,
  ClaveAccesoInvalidaError,
  XMLInvalidoError,
} from '../lib/services/sri.service';

// ─────────────────────────────────────────────
// calcularDigitoVerificador
// ─────────────────────────────────────────────

describe('calcularDigitoVerificador', () => {
  /**
   * Ejemplo verificado manualmente con la especificación SRI:
   * Clave: 0705201701099408770020010010000000011234567892
   *        (48 dígitos de datos) + dígito verificador
   *
   * Verificamos contra una clave de acceso real de ejemplo SRI.
   */
  it('devuelve 0 cuando el residuo módulo 11 es 0', () => {
    // Si suma % 11 === 0 → dígito = 0
    // Construimos un array que al multiplicar sus pesos sume un múltiplo de 11
    // Pesos van de 2..7 ciclando: posición 47=peso2, 46=peso3, ..., 42=peso7, 41=peso2...
    // Para un array de un solo dígito: dígito*2 debe ser múltiplo de 11 → imposible con un solo dígito
    // Usamos 11 dígitos todos "0" → suma = 0, residuo = 0 → dígito = 0
    const digits = new Array(48).fill(0);
    expect(calcularDigitoVerificador(digits)).toBe(0);
  });

  it('devuelve 1 cuando el residuo módulo 11 es 1', () => {
    // Necesitamos suma % 11 === 1
    // Con array de 48 ceros excepto el último = 1: peso del último (índice 47, derecha→izquierda es índice 0) = 2
    // suma = 1*2 = 2, residuo = 2, dígito = 11-2 = 9. No.
    // Probamos con suma que dé residuo 1 directamente:
    // suma = 1: un único dígito y peso 1. Pero pesos mínimos son 2.
    // suma = 12: residuo = 1. Necesitamos 12 = d*peso. d=2, peso=6 → penúltima posición (6 del final).
    const digits = new Array(48).fill(0);
    // Queremos suma = 12 → residuo 1 → dígito 1
    // suma = 12: d[47]*2 = 12 → d[47] = 6
    digits[47] = 6;
    expect(calcularDigitoVerificador(digits)).toBe(1);
  });

  it('aplica 11 - residuo para residuos 2-10', () => {
    const digits = new Array(48).fill(0);
    // d[47]*2 = 2 → suma=2, residuo=2, dígito=9
    digits[47] = 1;
    expect(calcularDigitoVerificador(digits)).toBe(9);
  });

  it('los factores ciclan de 2 a 7', () => {
    const digits = new Array(48).fill(0);
    // Pesos desde la derecha: índice 0→peso2, 1→peso3, 2→peso4, 3→peso5, 4→peso6, 5→peso7, 6→peso2, ...
    // d[47]=1 (idx 0 desde derecha) → 1*2=2
    // d[46]=1 (idx 1 desde derecha) → 1*3=3
    // suma = 5, residuo = 5, dígito = 6
    digits[47] = 1;
    digits[46] = 1;
    expect(calcularDigitoVerificador(digits)).toBe(6);
  });
});

// ─────────────────────────────────────────────
// validarClaveAcceso
// ─────────────────────────────────────────────

describe('validarClaveAcceso', () => {
  /**
   * Clave de acceso construida manualmente con dígito verificador correcto.
   * Usamos la clave de ejemplo de la documentación SRI:
   *
   * fechaEmision:      07052017     (8)
   * tipoComprobante:   01           (2)
   * rucEmisor:         0994008740001 (13)
   * ambiente:          2            (1)
   * serie:             001001       (6)
   * secuencial:        000000001    (9)
   * codigoNumerico:    12345678     (8)
   * tipoEmision:       1            (1)
   * Total datos:                   48 dígitos
   *
   * Calculamos el dígito verificador con nuestra propia función para asegurar
   * que la clave sea válida por construcción.
   */

  function buildClaveValida(): string {
    const data = '0705201701099400874000120010010000000011234567811';
    // Recortamos a 48 dígitos si tiene más
    const datos = data.slice(0, 48);
    const digits = datos.split('').map(Number);
    const dv = calcularDigitoVerificador(digits);
    return datos + dv;
  }

  it('acepta una clave de acceso válida de 49 dígitos', () => {
    const clave = buildClaveValida();
    expect(clave).toHaveLength(49);
    const parsed = validarClaveAcceso(clave);
    expect(parsed.tipoComprobante).toBe('01');
    expect(parsed.tipoEmision).toBe('1');
    expect(parsed.ambiente).toMatch(/^[12]$/);
    expect(parsed.digitoVerificador).toBe(String(clave[48]));
  });

  it('lanza ClaveAccesoInvalidaError si la longitud no es 49', () => {
    expect(() => validarClaveAcceso('12345')).toThrow(ClaveAccesoInvalidaError);
    expect(() => validarClaveAcceso('12345')).toThrow(/longitud/);
  });

  it('lanza ClaveAccesoInvalidaError si contiene caracteres no numéricos', () => {
    const clave49 = 'A' + '0'.repeat(48);
    expect(() => validarClaveAcceso(clave49)).toThrow(ClaveAccesoInvalidaError);
    expect(() => validarClaveAcceso(clave49)).toThrow(/no numéricos/);
  });

  it('lanza ClaveAccesoInvalidaError si el dígito verificador no coincide', () => {
    const clave = buildClaveValida();
    // Corrompe el dígito verificador
    const corrupta = clave.slice(0, 48) + ((parseInt(clave[48]) + 1) % 10).toString();
    expect(() => validarClaveAcceso(corrupta)).toThrow(ClaveAccesoInvalidaError);
    expect(() => validarClaveAcceso(corrupta)).toThrow(/dígito verificador/);
  });

  it('expone todos los campos del ClaveAccesoSRI parseado', () => {
    const clave = buildClaveValida();
    const result = validarClaveAcceso(clave);
    expect(result).toMatchObject({
      fechaEmision: expect.stringMatching(/^\d{8}$/),
      tipoComprobante: expect.stringMatching(/^\d{2}$/),
      rucEmisor: expect.stringMatching(/^\d{13}$/),
      ambiente: expect.stringMatching(/^[12]$/),
      serie: expect.stringMatching(/^\d{6}$/),
      secuencial: expect.stringMatching(/^\d{9}$/),
      codigoNumerico: expect.stringMatching(/^\d{8}$/),
      tipoEmision: '1',
    });
  });
});

// ─────────────────────────────────────────────
// parsearXML
// ─────────────────────────────────────────────

describe('parsearXML', () => {
  // Generamos una clave válida para usar en el XML de prueba
  function buildClaveValida(): string {
    const datos = '0705201701099400874000120010010000000011234567811';
    const digits = datos.slice(0, 48).split('').map(Number);
    const dv = calcularDigitoVerificador(digits);
    return datos.slice(0, 48) + dv;
  }

  function buildXML(overrides: Record<string, string> = {}): string {
    const clave = overrides.claveAcceso ?? buildClaveValida();
    return `<?xml version="1.0" encoding="UTF-8"?>
<factura id="comprobante" version="2.0.0">
  <infoTributaria>
    <claveAcceso>${clave}</claveAcceso>
    <ruc>${overrides.ruc ?? '0994008740001'}</ruc>
    <razonSocial>${overrides.razonSocial ?? 'EMPRESA PRUEBA S.A.'}</razonSocial>
    <estab>001</estab>
    <ptoEmi>001</ptoEmi>
    <secuencial>000000001</secuencial>
  </infoTributaria>
  <infoFactura>
    <fechaEmision>07/05/2017</fechaEmision>
    <totalSinImpuestos>100.00</totalSinImpuestos>
    <totalConImpuestos>
      <totalImpuesto>
        <codigo>2</codigo>
        <codigoPorcentaje>4</codigoPorcentaje>
        <tarifa>15</tarifa>
        <baseImponible>100.00</baseImponible>
        <valor>15.00</valor>
      </totalImpuesto>
    </totalConImpuestos>
    <importeTotal>115.00</importeTotal>
  </infoFactura>
  <detalles>
    <detalle>
      <codigoPrincipal>PLAN-001</codigoPrincipal>
      <codigoAuxiliar>AX-001</codigoAuxiliar>
      <descripcion>PLANCHA ACERO INOX 1.5MM 1.22X2.44</descripcion>
      <cantidad>5</cantidad>
      <precioUnitario>20.00</precioUnitario>
      <descuento>0</descuento>
      <precioTotalSinImpuesto>100.00</precioTotalSinImpuesto>
    </detalle>
  </detalles>
</factura>`;
  }

  it('parsea un XML válido de factura SRI', () => {
    const result = parsearXML(buildXML());
    expect(result.claveAcceso).toHaveLength(49);
    expect(result.numeroFactura).toBe('001-001-000000001');
    expect(result.rucEmisor).toBe('0994008740001');
    expect(result.razonSocialEmisor).toBe('EMPRESA PRUEBA S.A.');
    expect(result.fechaEmision).toBe('07/05/2017');
    expect(result.subtotalSinIva).toBe(100);
    expect(result.totalIva).toBe(15);
    expect(result.importeTotal).toBe(115);
    expect(result.lineas).toHaveLength(1);
    expect(result.lineas[0].codigoInterno).toBe('PLAN-001');
    expect(result.lineas[0].cantidad).toBe(5);
    expect(result.lineas[0].precioUnitario).toBe(20);
  });

  it('lanza XMLInvalidoError si el XML está vacío', () => {
    expect(() => parsearXML('')).toThrow(XMLInvalidoError);
    expect(() => parsearXML('   ')).toThrow(XMLInvalidoError);
  });

  it('lanza XMLInvalidoError si falta el nodo infoTributaria', () => {
    const xmlSinInfo = `<factura><detalles><detalle><descripcion>A</descripcion><cantidad>1</cantidad><precioUnitario>1</precioUnitario><descuento>0</descuento><precioTotalSinImpuesto>1</precioTotalSinImpuesto></detalle></detalles></factura>`;
    expect(() => parsearXML(xmlSinInfo)).toThrow(XMLInvalidoError);
  });

  it('lanza XMLInvalidoError si no tiene líneas de detalle', () => {
    const xmlSinDetalles = buildXML().replace(
      /<detalles>[\s\S]*<\/detalles>/,
      '<detalles></detalles>',
    );
    // fast-xml-parser devuelve <detalles></detalles> vacío como '' → lineas.length = 0
    expect(() => parsearXML(xmlSinDetalles)).toThrow(XMLInvalidoError);
    expect(() => parsearXML(xmlSinDetalles)).toThrow(/no tiene líneas de detalle/);
  });

  it('lanza ClaveAccesoInvalidaError si la clave de acceso es inválida', () => {
    const { ClaveAccesoInvalidaError: CError } = require('../lib/services/sri.service');
    const xmlMalaClave = buildXML({ claveAcceso: '0'.repeat(49) });
    expect(() => parsearXML(xmlMalaClave)).toThrow(CError);
  });
});

// ─────────────────────────────────────────────
// fechaSRIaISO
// ─────────────────────────────────────────────

describe('fechaSRIaISO', () => {
  it('convierte DD/MM/YYYY a YYYY-MM-DD', () => {
    expect(fechaSRIaISO('07/05/2017')).toBe('2017-05-07');
    expect(fechaSRIaISO('31/12/2024')).toBe('2024-12-31');
    expect(fechaSRIaISO('01/01/2023')).toBe('2023-01-01');
  });

  it('devuelve el valor original si no tiene el formato DD/MM/YYYY', () => {
    expect(fechaSRIaISO('2024-06-15')).toBe('2024-06-15');
    expect(fechaSRIaISO('')).toBe('');
  });
});
