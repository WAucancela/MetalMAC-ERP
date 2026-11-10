/**
 * __tests__/ride.service.test.ts
 *
 * ride.service.tsx no tenía test. `@react-pdf/renderer` (y su cadena de
 * dependencias — color-string, etc.) se publica en ESM puro sin build CJS, así
 * que Jest/ts-jest no lo puede cargar tal cual (ver intento fallido: forzar
 * transformIgnorePatterns abre un agujero sin fondo de paquetes transitivos en
 * ESM). Se mockea la librería en sí — total, lo que hay que testear acá es
 * NUESTRA lógica (qué textos arma `RideDocument` a partir de los datos de la
 * factura), no que @react-pdf sepa generar un PDF, eso es responsabilidad de
 * esa librería. React.createElement nunca invoca estos componentes (no hay
 * render real de por medio), así que el mock no necesita hacer nada más que
 * devolver sus props — `renderToBuffer` sí recorre el árbol de elementos a
 * mano para poder aserter sobre qué texto quedó en el documento.
 *
 * Ejecutar: npx jest --no-coverage
 */

/**
 * React.createElement nunca invoca los componentes de función — solo arma
 * `{type, props}`. Como acá no hay un renderer real (ni react-dom ni
 * react-test-renderer) de por medio, hay que "bajar" un nivel a mano llamando
 * `type(props)` cuando `type` es una función (tanto para `RideDocument` como
 * para los mocks de Document/Page/Text/View de abajo) hasta llegar a texto
 * plano u otros elementos.
 */
function recolectarTexto(nodo: unknown): string[] {
  if (nodo == null || typeof nodo === 'boolean') return [];
  if (typeof nodo === 'string' || typeof nodo === 'number') return [String(nodo)];
  if (Array.isArray(nodo)) return nodo.flatMap(recolectarTexto);
  if (typeof nodo === 'object' && nodo !== null && 'type' in nodo) {
    const elemento = nodo as { type: unknown; props?: unknown };
    if (typeof elemento.type === 'function') {
      return recolectarTexto((elemento.type as (props: unknown) => unknown)(elemento.props));
    }
  }
  return [];
}

jest.mock('@react-pdf/renderer', () => {
  // "Renderiza" directo a sus children — simula lo que haría un host component
  // sin necesidad de un renderer real.
  const identidad = (props: { children?: unknown }) => props?.children;
  return {
    Document: identidad,
    Page: identidad,
    Text: identidad,
    View: identidad,
    StyleSheet: { create: (estilos: unknown) => estilos },
    renderToBuffer: async (elemento: unknown) =>
      Buffer.from(`%PDF-FAKE\n${recolectarTexto(elemento).join('\n')}`, 'utf8'),
  };
});

import { generarRidePDF, type RideData } from '../lib/services/ride.service';

function rideDataBase(overrides: Partial<RideData> = {}): RideData {
  return {
    factura: {
      numeroFactura: '001-100-000000061',
      claveAcceso: '1234567890123456789012345678901234567890123456789',
      clienteNombre: 'Cliente de Prueba',
      clienteRuc: '1710000001',
      clienteEmail: 'cliente@example.com',
      fechaEmision: '2026-10-01',
      subtotalSinIva: 100,
      iva: 15,
      total: 115,
    },
    lineas: [
      { descripcion: 'Perfil de acero 2x2', cantidad: 10, precioUnitario: 10, subtotal: 100, ordenProduccionId: null },
    ],
    emisor: {
      ruc: '1790000000001',
      razonSocial: 'Taller MAC S.A.',
      nombreComercial: 'Taller MAC',
      dirMatriz: 'Av. Siempre Viva 123',
      dirEstablecimiento: 'Av. Siempre Viva 123',
      obligadoContabilidad: 'SI',
    },
    fechaAutorizacion: '2026-10-01T10:00:00Z',
    ambiente: 'PRODUCCION',
    ...overrides,
  };
}

describe('generarRidePDF', () => {
  it('incluye los datos del emisor, cliente, líneas y totales', async () => {
    const buffer = await generarRidePDF(rideDataBase());
    const texto = buffer.toString('utf8');

    expect(texto).toContain('Taller MAC S.A.');
    expect(texto).toContain('1790000000001');
    expect(texto).toContain('Cliente de Prueba');
    expect(texto).toContain('Perfil de acero 2x2');
    expect(texto).toContain('001-100-000000061');
    expect(texto).toContain('115.00');
  });

  it('no revienta con varias líneas ni con email de cliente vacío', async () => {
    const data = rideDataBase({
      factura: { ...rideDataBase().factura, clienteEmail: '' },
      lineas: [
        { descripcion: 'Línea 1', cantidad: 1, precioUnitario: 5, subtotal: 5, ordenProduccionId: null },
        { descripcion: 'Línea 2', cantidad: 2.5, precioUnitario: 3.33, subtotal: 8.33, ordenProduccionId: 'op-1' },
      ],
    });

    const buffer = await generarRidePDF(data);
    expect(buffer.toString('utf8')).toContain('Línea 2');
  });

  it('agrega el aviso de "sin valor tributario" solo en ambiente PRUEBAS', async () => {
    const textoProduccion = (await generarRidePDF(rideDataBase({ ambiente: 'PRODUCCION' }))).toString('utf8');
    const textoPruebas = (await generarRidePDF(rideDataBase({ ambiente: 'PRUEBAS' }))).toString('utf8');

    expect(textoProduccion).not.toContain('SIN VALOR TRIBUTARIO');
    expect(textoPruebas).toContain('SIN VALOR TRIBUTARIO');
  });
});
