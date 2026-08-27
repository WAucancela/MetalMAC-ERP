/**
 * facturas-compra.service.ts
 *
 * Transiciones de estado de una factura de compra que además mueven stock,
 * vía las funciones plpgsql de 20260826000000_stock_desde_factura_compra.sql:
 *   - procesarFacturaCompra: PENDIENTE -> PROCESADA, genera las entradas
 *   - anularFacturaCompra:   -> ANULADA, revierte las entradas si ya estaba PROCESADA
 *   - registrarDevolucionProveedor: devolución parcial sobre una factura PROCESADA
 *
 * Todo lo demás de facturas de compra (creación, mapeo de líneas, consultas)
 * sigue viviendo directo en las API routes — estas tres son las únicas
 * operaciones con una invariante real que proteger (que el stock y el estado
 * de la factura nunca queden desincronizados), por eso pasan por RPC atómico
 * en vez de un simple `.update()`.
 */

import { supabaseAdmin } from '@/lib/supabase/admin';
import { StockInsuficienteError, MaterialNoEncontradoError } from '../../types/metalmac.types';

export class FacturaNoEncontradaError extends Error {
  constructor(public readonly facturaId: string) {
    super(`No existe la factura de compra: ${facturaId}`);
    this.name = 'FacturaNoEncontradaError';
  }
}

export class EstadoFacturaInvalidoError extends Error {
  constructor(
    public readonly facturaId: string,
    public readonly estadoActual: string,
    public readonly esperado: string,
  ) {
    super(`La factura ${facturaId} está en estado ${estadoActual}, se esperaba ${esperado}`);
    this.name = 'EstadoFacturaInvalidoError';
  }
}

export class FacturaYaAnuladaError extends Error {
  constructor(public readonly facturaId: string) {
    super(`La factura ${facturaId} ya está anulada`);
    this.name = 'FacturaYaAnuladaError';
  }
}

function parseDetail(error: { details?: string | null }): Record<string, unknown> {
  try {
    return error.details ? JSON.parse(error.details) : {};
  } catch {
    return {};
  }
}

/** Traduce los códigos de error comunes a las tres RPC de este módulo a sus clases de dominio. */
function traducirError(error: { message: string; details?: string | null }, facturaId: string): Error {
  const detail = parseDetail(error);

  if (error.message.startsWith('FACTURA_NO_ENCONTRADA')) return new FacturaNoEncontradaError(facturaId);
  if (error.message.startsWith('FACTURA_YA_ANULADA')) return new FacturaYaAnuladaError(facturaId);
  if (error.message.startsWith('ESTADO_INVALIDO')) {
    return new EstadoFacturaInvalidoError(
      facturaId,
      String(detail.estadoActual ?? '?'),
      String(detail.esperado ?? '?'),
    );
  }
  if (error.message.startsWith('MATERIAL_NO_ENCONTRADO')) {
    return new MaterialNoEncontradoError(String(detail.materialId ?? ''));
  }
  if (
    error.message.startsWith('STOCK_INSUFICIENTE_ANULACION') ||
    error.message.startsWith('STOCK_INSUFICIENTE_DEVOLUCION')
  ) {
    return new StockInsuficienteError(
      String(detail.materialId ?? ''),
      Number(detail.disponible ?? 0),
      Number(detail.solicitado ?? 0),
    );
  }
  if (error.message.startsWith('CANTIDAD_INVALIDA')) {
    return new RangeError('La cantidad debe ser mayor a 0');
  }

  return new Error(error.message);
}

/** PENDIENTE -> PROCESADA. Genera un movimiento ENTRADA por cada línea ya resuelta a un material. */
export async function procesarFacturaCompra(facturaId: string, usuarioId: string): Promise<void> {
  const { error } = await supabaseAdmin.rpc('procesar_factura_compra', {
    p_factura_id: facturaId,
    p_usuario_id: usuarioId,
  });
  if (error) throw traducirError(error, facturaId);
}

/**
 * -> ANULADA. Si la factura ya estaba PROCESADA, revierte cada entrada generada
 * (AJUSTE_NEGATIVO) antes de anular; si no alcanza el stock disponible (ya se
 * consumió en otro lado), no anula nada y lanza StockInsuficienteError.
 */
export async function anularFacturaCompra(facturaId: string, usuarioId: string): Promise<void> {
  const { error } = await supabaseAdmin.rpc('anular_factura_compra', {
    p_factura_id: facturaId,
    p_usuario_id: usuarioId,
  });
  if (error) throw traducirError(error, facturaId);
}

export interface RegistrarDevolucionInput {
  facturaId: string;
  materialId: string;
  cantidad: number;
  usuarioId: string;
}

/** Devolución parcial a proveedor sobre una factura ya PROCESADA. Retorna el id del movimiento. */
export async function registrarDevolucionProveedor(input: RegistrarDevolucionInput): Promise<string> {
  const { data, error } = await supabaseAdmin.rpc('registrar_devolucion_proveedor', {
    p_factura_id: input.facturaId,
    p_material_id: input.materialId,
    p_cantidad: input.cantidad,
    p_usuario_id: input.usuarioId,
  });
  if (error) throw traducirError(error, input.facturaId);
  return data as string;
}
