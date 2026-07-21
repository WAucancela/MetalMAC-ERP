/**
 * __tests__/inventario.service.test.ts
 *
 * Tests unitarios para inventario.service.ts
 * Usa Jest + ts-jest con mocks manuales del Firebase Admin SDK.
 *
 * Ejecutar: npx jest --no-coverage
 */

// ─────────────────────────────────────────────────────────────────────────────
// Mocks — deben declararse ANTES de los imports del módulo bajo prueba.
// jest.mock() es elevado (hoisted) por ts-jest al inicio del archivo.
// ─────────────────────────────────────────────────────────────────────────────

const mockTransactionGet    = jest.fn();
const mockTransactionSet    = jest.fn();
const mockTransactionUpdate = jest.fn();
const mockRunTransaction    = jest.fn();
const mockGetDocs           = jest.fn();
const mockServerTimestamp   = jest.fn(() => ({ _type: 'serverTimestamp' }));

/** collectionRef falso: soporta .doc(id), .get() y .where(...).get() */
function makeCollectionRef(name: string) {
  return {
    doc: jest.fn((id?: string) => ({ id: id ?? 'auto-id', path: `${name}/${id ?? 'auto-id'}` })),
    get: jest.fn(() => mockGetDocs()),
    where: jest.fn(() => ({
      get: jest.fn(() => mockGetDocs()),
    })),
  };
}

const adminDbMock = {
  collection: jest.fn((name: string) => makeCollectionRef(name)),
  runTransaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => mockRunTransaction(fn)),
};

jest.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: () => mockServerTimestamp() },
}));

jest.mock('../lib/firebase-admin', () => ({ adminDb: adminDbMock }));

// ─────────────────────────────────────────────────────────────────────────────
// Imports del código bajo prueba (DESPUÉS de los mocks)
// ─────────────────────────────────────────────────────────────────────────────

import {
  convertirCantidad,
  convertirCantidadDesdeEquivalencia,
  obtenerAlertasStockBajo,
  registrarMovimiento,
} from '../lib/services/inventario.service';

import {
  StockInsuficienteError,
  MaterialNoEncontradoError,
} from '../types/metalmac.types';

import type { MovimientoInput } from '../types/metalmac.types';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de test
// ─────────────────────────────────────────────────────────────────────────────

/** Datos de stock sin Timestamp (Firestore mockeado → no existe Timestamp.now()) */
function makeStockData(overrides: Partial<{
  cantidadDisponible: number;
  cantidadReservada: number;
  cantidadMinima: number;
  cantidadMaxima: number | null;
  ubicacion: string;
}> = {}) {
  return {
    cantidadDisponible: 100,
    cantidadReservada:  0,
    cantidadMinima:     10,
    cantidadMaxima:     null,
    ubicacion:          'Bodega A',
    actualizadoEn:      { seconds: 0, nanoseconds: 0 }, // stub, no se valida en tests
    ...overrides,
  };
}

function makeMovimientoInput(overrides: Partial<MovimientoInput> = {}): MovimientoInput {
  return {
    materialId:       'mat-001',
    tipo:             'ENTRADA',
    cantidad:         5,
    costoUnitario:    126.50,
    documentoTipo:    'FACTURA_COMPRA',
    documentoId:      'fc-001',
    numeroReferencia: 'REF-001',
    notas:            'Test',
    usuarioId:        'user-001',
    ...overrides,
  };
}

/**
 * Configura mockRunTransaction para simular la ejecución de la función interna
 * con un transaction proxy que delega a los mocks individuales.
 */
function setupTransaction(stockData: ReturnType<typeof makeStockData>, exists = true) {
  mockRunTransaction.mockImplementationOnce(
    async (fn: (t: Record<string, jest.Mock>) => Promise<unknown>) => {
      const transaction = {
        get:    mockTransactionGet.mockResolvedValueOnce({
          exists,
          data:   () => stockData,
        }),
        set:    mockTransactionSet,
        update: mockTransactionUpdate,
      };
      return fn(transaction);
    },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite: convertirCantidad
// ─────────────────────────────────────────────────────────────────────────────

describe('convertirCantidad', () => {
  beforeEach(() => jest.clearAllMocks());

  it('convierte correctamente con factor entero', () => {
    expect(convertirCantidad(5, 2)).toBe(10);
  });

  it('convierte con factor decimal sin pérdida de precisión (0.1 + 0.2 problem)', () => {
    // 5 piezas × 2.44 m²/pieza = 12.20 — Number nativo daría 12.200000000000001
    expect(convertirCantidad(5, 2.44)).toBe(12.2);
  });

  it('maneja factor < 1 (ej: g → kg)', () => {
    // 1000 g × 0.001 = 1 kg
    expect(convertirCantidad(1000, 0.001)).toBe(1);
  });

  it('retorna 0 cuando cantidadProveedor = 0', () => {
    expect(convertirCantidad(0, 2.44)).toBe(0);
  });

  it('lanza RangeError si cantidadProveedor es negativa', () => {
    expect(() => convertirCantidad(-1, 2)).toThrow(RangeError);
    expect(() => convertirCantidad(-1, 2)).toThrow('cantidadProveedor debe ser >= 0');
  });

  it('lanza RangeError si factorConversion = 0', () => {
    expect(() => convertirCantidad(5, 0)).toThrow(RangeError);
    expect(() => convertirCantidad(5, 0)).toThrow('factorConversion debe ser > 0');
  });

  it('lanza RangeError si factorConversion es negativo', () => {
    expect(() => convertirCantidad(5, -1)).toThrow(RangeError);
  });

  it('limita el resultado a 6 decimales', () => {
    const result = convertirCantidad(1, 1 / 3);
    const decimals = result.toString().split('.')[1]?.length ?? 0;
    expect(decimals).toBeLessThanOrEqual(6);
  });
});

describe('convertirCantidadDesdeEquivalencia', () => {
  it('delega correctamente a convertirCantidad', () => {
    const eq = { factorConversion: 2.44 };
    expect(convertirCantidadDesdeEquivalencia(5, eq)).toBe(12.2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite: registrarMovimiento
// ─────────────────────────────────────────────────────────────────────────────

describe('registrarMovimiento', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('ENTRADA', () => {
    it('incrementa cantidadDisponible y crea movimiento', async () => {
      setupTransaction(makeStockData({ cantidadDisponible: 50 }));

      const id = await registrarMovimiento(
        makeMovimientoInput({ tipo: 'ENTRADA', cantidad: 10 }),
      );

      expect(typeof id).toBe('string');
      expect(mockTransactionUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ cantidadDisponible: 60 }),
      );
      expect(mockTransactionSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          tipo:          'ENTRADA',
          stockAnterior:  50,
          stockPosterior: 60,
          cantidad:       10,
        }),
      );
    });
  });

  describe('SALIDA', () => {
    it('reduce cantidadDisponible cuando hay stock suficiente', async () => {
      setupTransaction(makeStockData({ cantidadDisponible: 50 }));

      await registrarMovimiento(makeMovimientoInput({ tipo: 'SALIDA', cantidad: 20 }));

      expect(mockTransactionUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ cantidadDisponible: 30 }),
      );
    });

    it('lanza StockInsuficienteError cuando no hay stock suficiente', async () => {
      setupTransaction(makeStockData({ cantidadDisponible: 5 }));

      await expect(
        registrarMovimiento(makeMovimientoInput({ tipo: 'SALIDA', cantidad: 10 })),
      ).rejects.toThrow(StockInsuficienteError);
    });

    it('StockInsuficienteError expone materialId, disponible y solicitado', async () => {
      expect.assertions(4);
      setupTransaction(makeStockData({ cantidadDisponible: 3 }));

      try {
        await registrarMovimiento(
          makeMovimientoInput({ materialId: 'mat-abc', tipo: 'SALIDA', cantidad: 10 }),
        );
      } catch (e) {
        expect(e).toBeInstanceOf(StockInsuficienteError);
        const err = e as StockInsuficienteError;
        expect(err.materialId).toBe('mat-abc');
        expect(err.disponible).toBe(3);
        expect(err.solicitado).toBe(10);
      }
    });
  });

  describe('RESERVA', () => {
    it('mueve cantidad de disponible a reservada', async () => {
      setupTransaction(makeStockData({ cantidadDisponible: 100, cantidadReservada: 0 }));

      await registrarMovimiento(makeMovimientoInput({ tipo: 'RESERVA', cantidad: 30 }));

      expect(mockTransactionUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          cantidadDisponible: 70,
          cantidadReservada:  30,
        }),
      );
    });

    it('lanza StockInsuficienteError si disponible < cantidad reserva', async () => {
      setupTransaction(makeStockData({ cantidadDisponible: 5, cantidadReservada: 10 }));

      await expect(
        registrarMovimiento(makeMovimientoInput({ tipo: 'RESERVA', cantidad: 10 })),
      ).rejects.toThrow(StockInsuficienteError);
    });
  });

  describe('LIBERACION', () => {
    it('mueve cantidad de reservada a disponible', async () => {
      setupTransaction(makeStockData({ cantidadDisponible: 20, cantidadReservada: 30 }));

      await registrarMovimiento(makeMovimientoInput({ tipo: 'LIBERACION', cantidad: 30 }));

      expect(mockTransactionUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          cantidadDisponible: 50,
          cantidadReservada:  0,
        }),
      );
    });

    it('libera como máximo lo que hay en reservada (no genera negativo)', async () => {
      // Pide liberar 50 pero solo hay 20 en reservada → libera 20
      setupTransaction(makeStockData({ cantidadDisponible: 10, cantidadReservada: 20 }));

      await registrarMovimiento(makeMovimientoInput({ tipo: 'LIBERACION', cantidad: 50 }));

      expect(mockTransactionUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          cantidadDisponible: 30,
          cantidadReservada:  0,
        }),
      );
    });
  });

  describe('Errores de validación', () => {
    it('lanza MaterialNoEncontradoError cuando stock no existe', async () => {
      setupTransaction(makeStockData(), /* exists= */ false);

      await expect(
        registrarMovimiento(makeMovimientoInput()),
      ).rejects.toThrow(MaterialNoEncontradoError);
    });

    it('lanza RangeError si cantidad = 0', async () => {
      setupTransaction(makeStockData());

      await expect(
        registrarMovimiento(makeMovimientoInput({ cantidad: 0 })),
      ).rejects.toThrow(RangeError);
    });

    it('lanza RangeError si cantidad < 0', async () => {
      setupTransaction(makeStockData());

      await expect(
        registrarMovimiento(makeMovimientoInput({ cantidad: -5 })),
      ).rejects.toThrow(RangeError);
    });

    it('guarda documentoId como null cuando no se provee', async () => {
      setupTransaction(makeStockData({ cantidadDisponible: 100 }));

      const input = makeMovimientoInput({ tipo: 'ENTRADA' });
      delete (input as Partial<MovimientoInput>).documentoId;

      await registrarMovimiento(input);

      expect(mockTransactionSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ documentoId: null }),
      );
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite: obtenerAlertasStockBajo
// ─────────────────────────────────────────────────────────────────────────────

describe('obtenerAlertasStockBajo', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retorna arreglo vacío cuando ningún material está bajo mínimo', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        {
          id:   'mat-001',
          data: () => makeStockData({ cantidadDisponible: 50, cantidadMinima: 10 }),
        },
      ],
    });

    const alertas = await obtenerAlertasStockBajo();
    expect(alertas).toHaveLength(0);
    // Solo debe llamarse UNA vez (no hay bajo-mínimo → no busca materiales)
    expect(mockGetDocs).toHaveBeenCalledTimes(1);
  });

  it('retorna alerta con datos correctos para material bajo mínimo', async () => {
    mockGetDocs
      // 1ª llamada → colección /stock
      .mockResolvedValueOnce({
        docs: [
          { id: 'mat-001', data: () => makeStockData({ cantidadDisponible: 3, cantidadMinima: 10 }) },
          { id: 'mat-002', data: () => makeStockData({ cantidadDisponible: 50, cantidadMinima: 10 }) },
        ],
      })
      // 2ª llamada → query /materiales
      .mockResolvedValueOnce({
        docs: [
          {
            id:   'mat-001',
            data: () => ({
              codigoInterno: 'ACX-001',
              nombre:        'Plancha AISI 304',
              tipo:          'PLANCHA',
              activo:        true,
            }),
          },
        ],
      });

    const alertas = await obtenerAlertasStockBajo();

    expect(alertas).toHaveLength(1);
    expect(alertas[0].materialId).toBe('mat-001');
    expect(alertas[0].cantidadDisponible).toBe(3);
    expect(alertas[0].cantidadMinima).toBe(10);
    expect(alertas[0].diferencia).toBe(7);
    expect(alertas[0].material?.codigoInterno).toBe('ACX-001');
  });

  it('incluye alerta con material=null si no existe en /materiales', async () => {
    mockGetDocs
      .mockResolvedValueOnce({
        docs: [
          { id: 'mat-ghost', data: () => makeStockData({ cantidadDisponible: 0, cantidadMinima: 5 }) },
        ],
      })
      .mockResolvedValueOnce({ docs: [] }); // no encontrado

    const alertas = await obtenerAlertasStockBajo();
    expect(alertas).toHaveLength(1);
    expect(alertas[0].material).toBeNull();
    expect(alertas[0].diferencia).toBe(5);
  });

  it('calcula diferencia correctamente para múltiples alertas simultáneas', async () => {
    mockGetDocs
      .mockResolvedValueOnce({
        docs: [
          { id: 'A', data: () => makeStockData({ cantidadDisponible: 1,  cantidadMinima: 10 }) },
          { id: 'B', data: () => makeStockData({ cantidadDisponible: 8,  cantidadMinima: 15 }) },
          { id: 'C', data: () => makeStockData({ cantidadDisponible: 20, cantidadMinima: 10 }) }, // OK
        ],
      })
      .mockResolvedValueOnce({ docs: [] });

    const alertas = await obtenerAlertasStockBajo();

    expect(alertas).toHaveLength(2);
    expect(alertas.find((a) => a.materialId === 'A')?.diferencia).toBe(9);
    expect(alertas.find((a) => a.materialId === 'B')?.diferencia).toBe(7);
    expect(alertas.find((a) => a.materialId === 'C')).toBeUndefined();
  });
});
