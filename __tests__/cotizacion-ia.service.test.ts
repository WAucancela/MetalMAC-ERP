/**
 * __tests__/cotizacion-ia.service.test.ts
 *
 * Mockea el cliente de Anthropic (@anthropic-ai/sdk) — no pega a la API real.
 * Verifica que el catálogo se pase completo al prompt, que el resultado
 * parseado se devuelva tal cual, y el caso límite de catálogo vacío (no tiene
 * sentido llamar al modelo si no hay nada contra qué matchear).
 *
 * Ejecutar: npx jest --no-coverage
 */

const mockParse = jest.fn();

jest.mock('@anthropic-ai/sdk', () =>
  jest.fn().mockImplementation(() => ({
    messages: { parse: (...args: unknown[]) => mockParse(...args) },
  })),
);

import { generarLineasCotizacionIA, type ProductoCatalogoIA } from '../lib/services/cotizacion-ia.service';

function makeProducto(overrides: Partial<ProductoCatalogoIA> = {}): ProductoCatalogoIA {
  return {
    id: 'prod-1',
    codigo: 'PTDL001',
    nombre: 'DISPENSADOR DE PAPEL JUMBO INDUSTRIAL CON LOGO LA REFORMA',
    descripcion: '',
    precioVenta: 9.57,
    unidadVenta: 'und',
    ...overrides,
  };
}

beforeEach(() => jest.clearAllMocks());

describe('generarLineasCotizacionIA', () => {
  it('no llama al modelo si el catálogo está vacío — devuelve todo como sin match', async () => {
    const resultado = await generarLineasCotizacionIA('necesito 10 dispensadores', []);

    expect(mockParse).not.toHaveBeenCalled();
    expect(resultado).toEqual({
      lineas: [],
      itemsSinMatch: ['necesito 10 dispensadores'],
      notas: '',
    });
  });

  it('pasa el catálogo completo en el system prompt y el texto del cliente en el mensaje', async () => {
    mockParse.mockResolvedValueOnce({
      parsed_output: { lineas: [], itemsSinMatch: [], notas: '' },
    });

    const catalogo = [makeProducto(), makeProducto({ id: 'prod-2', codigo: 'PTDL002' })];
    await generarLineasCotizacionIA('pedido del cliente', catalogo);

    expect(mockParse).toHaveBeenCalledTimes(1);
    const callArgs = mockParse.mock.calls[0][0];
    expect(callArgs.model).toBe('claude-opus-5');
    expect(callArgs.system).toContain('PTDL001');
    expect(callArgs.system).toContain('PTDL002');
    expect(callArgs.system).toContain('9.57');
    expect(callArgs.messages).toEqual([{ role: 'user', content: 'pedido del cliente' }]);
  });

  it('devuelve el parsed_output tal cual cuando el modelo matchea líneas', async () => {
    const salida = {
      lineas: [{ productoId: 'prod-1', descripcion: 'Dispensador La Reforma', cantidad: 10, precioUnitario: 9.57 }],
      itemsSinMatch: ['tornillos especiales que no vendemos'],
      notas: 'Cotización de dispensadores según lo solicitado.',
    };
    mockParse.mockResolvedValueOnce({ parsed_output: salida });

    const resultado = await generarLineasCotizacionIA('10 dispensadores y tornillos especiales', [makeProducto()]);

    expect(resultado).toEqual(salida);
  });

  it('lanza un error legible si el modelo no devuelve parsed_output', async () => {
    mockParse.mockResolvedValueOnce({ parsed_output: null });

    await expect(
      generarLineasCotizacionIA('pedido raro', [makeProducto()]),
    ).rejects.toThrow('No se pudo interpretar el pedido');
  });
});
