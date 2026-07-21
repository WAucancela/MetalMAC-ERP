/**
 * __tests__/inventario.service.test.ts
 *
 * Tests unitarios para inventario.service.ts.
 * Mockea `supabaseAdmin` (RPC + queries) en vez del proxy de transacción de
 * Firestore que usaba la versión anterior. La lógica de ramas por `tipo`
 * (SALIDA reduce, RESERVA mueve disponible→reservada, etc.) ahora vive en la
 * función plpgsql `registrar_movimiento_inventario` — se verificó manualmente
 * contra una instancia real de Postgres durante la Fase 1 de la migración
 * (ver supabase/migrations/*_rpc_bom_stock.sql). Estos tests cubren lo que
 * queda en la capa TS: los parámetros que se envían al RPC, el mapeo de
 * errores de Postgres a las clases de dominio, y la lógica de
 * `obtenerAlertasStockBajo` (que sigue filtrando en memoria).
 *
 * Ejecutar: npx jest --no-coverage
 */

// ─────────────────────────────────────────────────────────────────────────────
// Mocks — deben declararse ANTES de los imports del módulo bajo prueba.
// ─────────────────────────────────────────────────────────────────────────────

const mockRpc = jest.fn();
const mockSelect = jest.fn();

jest.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (table: string) => ({
      select: (...args: unknown[]) => mockSelect(table, ...args),
    }),
  },
}));

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

// ─────────────────────────────────────────────────────────────────────────────
// Suite: convertirCantidad (pura, sin cambios)
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

  it('llama al RPC registrar_movimiento_inventario con los parámetros correctos', async () => {
    mockRpc.mockResolvedValueOnce({ data: 'mov-123', error: null });

    const id = await registrarMovimiento(
      makeMovimientoInput({ tipo: 'ENTRADA', cantidad: 10, materialId: 'mat-abc' }),
    );

    expect(id).toBe('mov-123');
    expect(mockRpc).toHaveBeenCalledWith('registrar_movimiento_inventario', {
      p_material_id: 'mat-abc',
      p_tipo: 'ENTRADA',
      p_cantidad: 10,
      p_costo_unitario: 126.50,
      p_documento_tipo: 'FACTURA_COMPRA',
      p_documento_id: 'fc-001',
      p_numero_referencia: 'REF-001',
      p_notas: 'Test',
      p_usuario_id: 'user-001',
    });
  });

  it('pasa null como documento_id cuando no se provee', async () => {
    mockRpc.mockResolvedValueOnce({ data: 'mov-124', error: null });

    const input = makeMovimientoInput({ tipo: 'ENTRADA' });
    delete (input as Partial<MovimientoInput>).documentoId;

    await registrarMovimiento(input);

    expect(mockRpc).toHaveBeenCalledWith(
      'registrar_movimiento_inventario',
      expect.objectContaining({ p_documento_id: null }),
    );
  });

  it('lanza StockInsuficienteError cuando el RPC reporta STOCK_INSUFICIENTE', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: {
        message: 'STOCK_INSUFICIENTE',
        details: JSON.stringify({ materialId: 'mat-abc', disponible: 3, solicitado: 10 }),
      },
    });

    await expect(
      registrarMovimiento(makeMovimientoInput({ materialId: 'mat-abc', tipo: 'SALIDA', cantidad: 10 })),
    ).rejects.toThrow(StockInsuficienteError);
  });

  it('StockInsuficienteError expone materialId, disponible y solicitado', async () => {
    expect.assertions(4);
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: {
        message: 'STOCK_INSUFICIENTE',
        details: JSON.stringify({ materialId: 'mat-abc', disponible: 3, solicitado: 10 }),
      },
    });

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

  it('lanza MaterialNoEncontradoError cuando el RPC reporta MATERIAL_NO_ENCONTRADO', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: {
        message: 'MATERIAL_NO_ENCONTRADO',
        details: JSON.stringify({ materialId: 'mat-fantasma' }),
      },
    });

    await expect(
      registrarMovimiento(makeMovimientoInput({ materialId: 'mat-fantasma' })),
    ).rejects.toThrow(MaterialNoEncontradoError);
  });

  it('lanza RangeError si cantidad = 0 sin llamar al RPC', async () => {
    await expect(
      registrarMovimiento(makeMovimientoInput({ cantidad: 0 })),
    ).rejects.toThrow(RangeError);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('lanza RangeError si cantidad < 0 sin llamar al RPC', async () => {
    await expect(
      registrarMovimiento(makeMovimientoInput({ cantidad: -5 })),
    ).rejects.toThrow(RangeError);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite: obtenerAlertasStockBajo
// ─────────────────────────────────────────────────────────────────────────────

describe('obtenerAlertasStockBajo', () => {
  beforeEach(() => jest.clearAllMocks());

  function makeStockRow(overrides: Record<string, unknown> = {}) {
    return {
      material_id: 'mat-001',
      cantidad_disponible: 50,
      cantidad_reservada: 0,
      cantidad_minima: 10,
      cantidad_maxima: null,
      ubicacion: 'Bodega A',
      actualizado_en: '2026-01-01T00:00:00Z',
      materiales: null,
      ...overrides,
    };
  }

  it('retorna arreglo vacío cuando ningún material está bajo mínimo', async () => {
    mockSelect.mockResolvedValueOnce({
      data: [makeStockRow({ cantidad_disponible: 50, cantidad_minima: 10 })],
      error: null,
    });

    const alertas = await obtenerAlertasStockBajo();
    expect(alertas).toHaveLength(0);
    expect(mockSelect).toHaveBeenCalledWith('stock', '*, materiales(*)');
  });

  it('retorna alerta con datos correctos para material bajo mínimo', async () => {
    mockSelect.mockResolvedValueOnce({
      data: [
        makeStockRow({
          material_id: 'mat-001',
          cantidad_disponible: 3,
          cantidad_minima: 10,
          materiales: {
            id: 'mat-001',
            codigo_interno: 'ACX-001',
            nombre: 'Plancha AISI 304',
            descripcion: '',
            tipo: 'PLANCHA',
            categoria_id: 'cat-1',
            grado: '',
            unidad_base_id: 'u-1',
            costo_unitario: 15.5,
            especificaciones: {},
            activo: true,
            creado_en: '2026-01-01T00:00:00Z',
            modificado_en: '2026-01-01T00:00:00Z',
          },
        }),
        makeStockRow({ material_id: 'mat-002', cantidad_disponible: 50, cantidad_minima: 10 }),
      ],
      error: null,
    });

    const alertas = await obtenerAlertasStockBajo();

    expect(alertas).toHaveLength(1);
    expect(alertas[0].materialId).toBe('mat-001');
    expect(alertas[0].cantidadDisponible).toBe(3);
    expect(alertas[0].cantidadMinima).toBe(10);
    expect(alertas[0].diferencia).toBe(7);
    expect(alertas[0].material?.codigoInterno).toBe('ACX-001');
  });

  it('incluye alerta con material=null si el join no trae materiales', () => {
    return (async () => {
      mockSelect.mockResolvedValueOnce({
        data: [makeStockRow({ material_id: 'mat-ghost', cantidad_disponible: 0, cantidad_minima: 5, materiales: null })],
        error: null,
      });

      const alertas = await obtenerAlertasStockBajo();
      expect(alertas).toHaveLength(1);
      expect(alertas[0].material).toBeNull();
      expect(alertas[0].diferencia).toBe(5);
    })();
  });

  it('calcula diferencia correctamente para múltiples alertas simultáneas', async () => {
    mockSelect.mockResolvedValueOnce({
      data: [
        makeStockRow({ material_id: 'A', cantidad_disponible: 1,  cantidad_minima: 10 }),
        makeStockRow({ material_id: 'B', cantidad_disponible: 8,  cantidad_minima: 15 }),
        makeStockRow({ material_id: 'C', cantidad_disponible: 20, cantidad_minima: 10 }), // OK
      ],
      error: null,
    });

    const alertas = await obtenerAlertasStockBajo();

    expect(alertas).toHaveLength(2);
    expect(alertas.find((a) => a.materialId === 'A')?.diferencia).toBe(9);
    expect(alertas.find((a) => a.materialId === 'B')?.diferencia).toBe(7);
    expect(alertas.find((a) => a.materialId === 'C')).toBeUndefined();
  });
});
