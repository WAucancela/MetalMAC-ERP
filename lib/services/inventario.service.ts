/**
 * inventario.service.ts
 *
 * Lógica de negocio de inventario para MetalMAC ERP.
 * Toda operación que modifica `stock` pasa por la función plpgsql
 * `registrar_movimiento_inventario` (vía RPC) — la atomicidad la garantiza
 * Postgres con `SELECT ... FOR UPDATE`, no este archivo.
 * Usa decimal.js para aritmética monetaria y de cantidades (sin pérdida de precisión).
 *
 * Usa el cliente service_role (server-only) — llamado exclusivamente desde API Routes.
 */

import Decimal from 'decimal.js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type {
  MovimientoInput,
  Material,
  TablaEquivalencia,
} from '../../types/metalmac.types';
import {
  StockInsuficienteError,
  MaterialNoEncontradoError,
} from '../../types/metalmac.types';
import { mapMaterialRow } from '@/lib/services/mappers';

// ─────────────────────────────────────────────────────────────────────────────
// registrarMovimiento
//
// Registra un movimiento de inventario vía la función plpgsql
// `registrar_movimiento_inventario`, que actualiza `stock` e inserta el
// `movimientos_inventario` correspondiente en una sola transacción con
// `SELECT ... FOR UPDATE` sobre la fila de stock.
//
// Lanza StockInsuficienteError si el tipo es de salida y no hay stock suficiente.
// Lanza MaterialNoEncontradoError si no existe la fila stock/{materialId}.
// ─────────────────────────────────────────────────────────────────────────────

export async function registrarMovimiento(input: MovimientoInput): Promise<string> {
  if (input.cantidad <= 0) {
    throw new RangeError(`La cantidad debe ser mayor a 0. Recibido: ${input.cantidad}`);
  }

  const { data, error } = await supabaseAdmin.rpc('registrar_movimiento_inventario', {
    p_material_id: input.materialId,
    p_tipo: input.tipo,
    p_cantidad: input.cantidad,
    p_costo_unitario: input.costoUnitario,
    p_documento_tipo: input.documentoTipo,
    // `supabase gen types` no marca los args de funciones como nullable aunque el
    // parámetro Postgres (uuid, sin default) sí acepta NULL — cast documentado.
    p_documento_id: (input.documentoId ?? null) as string,
    p_numero_referencia: input.numeroReferencia,
    p_notas: input.notas ?? '',
    p_usuario_id: input.usuarioId,
  });

  if (error) {
    const detail = error.details ? JSON.parse(error.details) : {};
    if (error.message.startsWith('MATERIAL_NO_ENCONTRADO')) {
      throw new MaterialNoEncontradoError(detail.materialId ?? input.materialId);
    }
    if (error.message.startsWith('STOCK_INSUFICIENTE')) {
      throw new StockInsuficienteError(detail.materialId, detail.disponible, detail.solicitado);
    }
    if (error.message.startsWith('CANTIDAD_INVALIDA')) {
      throw new RangeError(`La cantidad debe ser mayor a 0. Recibido: ${input.cantidad}`);
    }
    throw new Error(error.message);
  }

  return data as string;
}

// ─────────────────────────────────────────────────────────────────────────────
// convertirCantidad
//
// Convierte una cantidad desde la unidad del proveedor a la unidad base interna,
// usando el factorConversion de TablaEquivalencia.
//
// Fórmula: cantidadBase = cantidadProveedor * factorConversion
//
// Ejemplo: proveedor vende en "piezas" donde 1 pieza = 2.44 m²
//   convertirCantidad(5, 2.44) → 12.20 m²
// ─────────────────────────────────────────────────────────────────────────────

export function convertirCantidad(
  cantidadProveedor: number,
  factorConversion: number,
): number {
  if (cantidadProveedor < 0) {
    throw new RangeError(`cantidadProveedor debe ser >= 0. Recibido: ${cantidadProveedor}`);
  }
  if (factorConversion <= 0) {
    throw new RangeError(`factorConversion debe ser > 0. Recibido: ${factorConversion}`);
  }

  return new Decimal(cantidadProveedor)
    .times(new Decimal(factorConversion))
    .toDecimalPlaces(6) // precisión máxima para materiales
    .toNumber();
}

/**
 * Sobrecarga tipada que acepta directamente una TablaEquivalencia.
 */
export function convertirCantidadDesdeEquivalencia(
  cantidadProveedor: number,
  equivalencia: Pick<TablaEquivalencia, 'factorConversion'>,
): number {
  return convertirCantidad(cantidadProveedor, equivalencia.factorConversion);
}

// ─────────────────────────────────────────────────────────────────────────────
// obtenerAlertasStockBajo
//
// Retorna todos los materiales cuya cantidadDisponible < cantidadMinima.
//
// Un solo round trip: `stock` con `materiales` embebido (join vía FK), en vez del
// escaneo completo + batch de 10 en 10 que requería Firestore. El filtro
// disponible < mínima se aplica en memoria porque PostgREST no expresa
// comparaciones columna-contra-columna del mismo row en su sintaxis de filtros.
// ─────────────────────────────────────────────────────────────────────────────

export async function obtenerAlertasStockBajo(): Promise<AlertaStockBajo[]> {
  const { data, error } = await supabaseAdmin
    .from('stock')
    .select('*, materiales(*)');
  if (error) throw error;

  const alertas: AlertaStockBajo[] = [];
  for (const row of data ?? []) {
    const cantidadDisponible = Number(row.cantidad_disponible);
    const cantidadMinima = Number(row.cantidad_minima);
    if (cantidadDisponible >= cantidadMinima) continue;

    alertas.push({
      material: row.materiales ? mapMaterialRow(row.materiales) : null,
      materialId: row.material_id,
      cantidadDisponible,
      cantidadMinima,
      diferencia: new Decimal(cantidadMinima).minus(cantidadDisponible).toNumber(),
      ubicacion: row.ubicacion,
    });
  }

  return alertas;
}

export interface AlertaStockBajo {
  material: Material | null;
  materialId: string;
  cantidadDisponible: number;
  cantidadMinima: number;
  /** Cuántas unidades faltan para alcanzar el mínimo */
  diferencia: number;
  ubicacion: string;
}
