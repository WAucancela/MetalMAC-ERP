/**
 * __tests__/facturas-compra.service.test.ts
 *
 * Igual que inventario.service.test.ts: mockea supabaseAdmin.rpc y verifica
 * (a) los parámetros que se le pasan a cada función plpgsql y (b) que los
 * códigos de error que puede lanzar el RPC (ver
 * supabase/migrations/20260826000000_stock_desde_factura_compra.sql) se
 * traducen a las clases de dominio correctas. La lógica de negocio en sí
 * (qué líneas generan movimiento, el signo de cada tipo, el bloqueo por
 * stock insuficiente) vive en SQL y no se re-testea acá.
 *
 * Ejecutar: npx jest --no-coverage
 */

const mockRpc = jest.fn();

jest.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

import {
  procesarFacturaCompra,
  anularFacturaCompra,
  registrarDevolucionProveedor,
  FacturaNoEncontradaError,
  EstadoFacturaInvalidoError,
  FacturaYaAnuladaError,
  MaterialNoPerteneceFacturaError,
} from '../lib/services/facturas-compra.service';
import { StockInsuficienteError, MaterialNoEncontradoError } from '../types/metalmac.types';

beforeEach(() => jest.clearAllMocks());

describe('procesarFacturaCompra', () => {
  it('llama a procesar_factura_compra con los parámetros correctos', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });

    await procesarFacturaCompra('fc-1', 'user-1');

    expect(mockRpc).toHaveBeenCalledWith('procesar_factura_compra', {
      p_factura_id: 'fc-1',
      p_usuario_id: 'user-1',
    });
  });

  it('lanza FacturaNoEncontradaError si el RPC reporta FACTURA_NO_ENCONTRADA', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'FACTURA_NO_ENCONTRADA', details: JSON.stringify({ facturaId: 'fc-x' }) },
    });

    await expect(procesarFacturaCompra('fc-x', 'user-1')).rejects.toThrow(FacturaNoEncontradaError);
  });

  it('lanza EstadoFacturaInvalidoError si la factura no está PENDIENTE', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: {
        message: 'ESTADO_INVALIDO',
        details: JSON.stringify({ facturaId: 'fc-1', estadoActual: 'PROCESADA', esperado: 'PENDIENTE' }),
      },
    });

    await expect(procesarFacturaCompra('fc-1', 'user-1')).rejects.toThrow(EstadoFacturaInvalidoError);
  });

  it('lanza MaterialNoEncontradoError si una línea apunta a un material sin fila de stock', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'MATERIAL_NO_ENCONTRADO', details: JSON.stringify({ materialId: 'mat-x' }) },
    });

    await expect(procesarFacturaCompra('fc-1', 'user-1')).rejects.toThrow(MaterialNoEncontradoError);
  });
});

describe('anularFacturaCompra', () => {
  it('llama a anular_factura_compra con los parámetros correctos', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });

    await anularFacturaCompra('fc-1', 'user-1');

    expect(mockRpc).toHaveBeenCalledWith('anular_factura_compra', {
      p_factura_id: 'fc-1',
      p_usuario_id: 'user-1',
    });
  });

  it('lanza FacturaYaAnuladaError si ya estaba anulada', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'FACTURA_YA_ANULADA', details: JSON.stringify({ facturaId: 'fc-1' }) },
    });

    await expect(anularFacturaCompra('fc-1', 'user-1')).rejects.toThrow(FacturaYaAnuladaError);
  });

  it('lanza StockInsuficienteError si un material ya se consumió y no alcanza para revertir', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: {
        message: 'STOCK_INSUFICIENTE_ANULACION',
        details: JSON.stringify({ materialId: 'mat-abc', disponible: 2, solicitado: 10 }),
      },
    });

    await expect(anularFacturaCompra('fc-1', 'user-1')).rejects.toThrow(StockInsuficienteError);
  });

  it('StockInsuficienteError expone materialId, disponible y solicitado al anular', async () => {
    expect.assertions(3);
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: {
        message: 'STOCK_INSUFICIENTE_ANULACION',
        details: JSON.stringify({ materialId: 'mat-abc', disponible: 2, solicitado: 10 }),
      },
    });

    try {
      await anularFacturaCompra('fc-1', 'user-1');
    } catch (e) {
      const err = e as StockInsuficienteError;
      expect(err.materialId).toBe('mat-abc');
      expect(err.disponible).toBe(2);
      expect(err.solicitado).toBe(10);
    }
  });
});

describe('registrarDevolucionProveedor', () => {
  const input = { facturaId: 'fc-1', materialId: 'mat-1', cantidad: 5, usuarioId: 'user-1' };

  it('llama a registrar_devolucion_proveedor con los parámetros correctos y retorna el id', async () => {
    mockRpc.mockResolvedValueOnce({ data: 'mov-999', error: null });

    const id = await registrarDevolucionProveedor(input);

    expect(id).toBe('mov-999');
    expect(mockRpc).toHaveBeenCalledWith('registrar_devolucion_proveedor', {
      p_factura_id: 'fc-1',
      p_material_id: 'mat-1',
      p_cantidad: 5,
      p_usuario_id: 'user-1',
    });
  });

  it('lanza EstadoFacturaInvalidoError si la factura no está PROCESADA', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: {
        message: 'ESTADO_INVALIDO',
        details: JSON.stringify({ facturaId: 'fc-1', estadoActual: 'PENDIENTE', esperado: 'PROCESADA' }),
      },
    });

    await expect(registrarDevolucionProveedor(input)).rejects.toThrow(EstadoFacturaInvalidoError);
  });

  it('lanza StockInsuficienteError si se pide devolver más de lo disponible', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: {
        message: 'STOCK_INSUFICIENTE_DEVOLUCION',
        details: JSON.stringify({ materialId: 'mat-1', disponible: 3, solicitado: 5 }),
      },
    });

    await expect(registrarDevolucionProveedor(input)).rejects.toThrow(StockInsuficienteError);
  });

  it('lanza MaterialNoPerteneceFacturaError si el material no está en ninguna línea de la factura', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: {
        message: 'MATERIAL_NO_PERTENECE_FACTURA',
        details: JSON.stringify({ facturaId: 'fc-1', materialId: 'mat-ajeno' }),
      },
    });

    await expect(registrarDevolucionProveedor(input)).rejects.toThrow(MaterialNoPerteneceFacturaError);
  });
});
