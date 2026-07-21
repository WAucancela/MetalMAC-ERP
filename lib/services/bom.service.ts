/**
 * bom.service.ts — Lógica de BOM (Bill of Materials) y Órdenes de Producción
 *
 * Reglas críticas:
 * - TODA aritmética pura usa decimal.js (nunca Number para costos o cantidades)
 * - cantidadConMerma = cantidadBase * factorMerma (aplicado por línea, no globalmente)
 * - reservar/liberar/consumir materiales corren como funciones plpgsql (`SELECT ... FOR
 *   UPDATE`) invocadas vía `supabaseAdmin.rpc()` — la atomicidad la garantiza Postgres,
 *   no este archivo (ver supabase/migrations/*_rpc_bom_stock.sql).
 * - Al COMPLETAR una OP: RESERVA → SALIDA (consume), libera lo no consumido
 * - Al CANCELAR una OP: RESERVA → LIBERACION (devuelve al disponible)
 *
 * Usa el cliente service_role (server-only) — llamado exclusivamente desde API Routes.
 */

import Decimal from 'decimal.js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type {
  BOM,
  LineaBOM,
  OperacionBOM,
  Material,
  Stock,
  MaterialReservado,
} from '@/types/metalmac.types';
import { mapMaterialRow, mapStockRow } from '@/lib/services/mappers';

// ─────────────────────────────────────────────
// Errores de dominio
// ─────────────────────────────────────────────

export class BOMNoEncontradoError extends Error {
  constructor(public readonly productoId: string) {
    super(`BOM no encontrado para producto: ${productoId}`);
    this.name = 'BOMNoEncontradoError';
  }
}

export class StockInsuficienteParaOPError extends Error {
  constructor(
    public readonly materialId: string,
    public readonly requerido: number,
    public readonly disponible: number,
  ) {
    super(
      `Stock insuficiente para OP — material ${materialId}: requerido=${requerido}, disponible=${disponible}`,
    );
    this.name = 'StockInsuficienteParaOPError';
  }
}

/** Traduce un error de una función RPC de Postgres a las clases de error de dominio. */
function throwBomRpcError(error: { message: string; details?: string | null }): never {
  const detail = error.details ? JSON.parse(error.details) : {};
  if (error.message.startsWith('MATERIAL_NO_ENCONTRADO')) {
    // Mismo tratamiento que la versión Firestore: un material sin fila de stock se
    // reporta como stock insuficiente (0 disponible), no como un error aparte.
    throw new StockInsuficienteParaOPError(detail.materialId ?? '', 0, 0);
  }
  if (error.message.startsWith('STOCK_INSUFICIENTE_OP')) {
    throw new StockInsuficienteParaOPError(detail.materialId, detail.requerido, detail.disponible);
  }
  if (error.message.startsWith('BOM_NO_ENCONTRADO')) {
    throw new BOMNoEncontradoError(detail.productoId ?? '');
  }
  throw new Error(error.message);
}

// ─────────────────────────────────────────────
// calcularCantidadConMerma (pura)
// ─────────────────────────────────────────────

/**
 * Aplica el factor de merma a una cantidad base.
 * cantidadConMerma = cantidadBase * factorMerma * unidades
 * Resultado redondeado a 6 decimales para evitar errores de punto flotante.
 */
export function calcularCantidadConMerma(
  cantidadBase: number,
  factorMerma: number,
  unidades: number,
): number {
  return new Decimal(cantidadBase)
    .times(factorMerma)
    .times(unidades)
    .toDecimalPlaces(6)
    .toNumber();
}

// ─────────────────────────────────────────────
// calcularCostoBOM (pura — recibe datos ya cargados)
// ─────────────────────────────────────────────

export interface LineaCostoBOM {
  materialId: string;
  nombreMaterial: string;
  cantidadBase: number;
  factorMerma: number;
  cantidadConMerma: number;    // para `unidades` unidades del producto
  costoUnitarioMaterial: number;
  costoLinea: number;
}

export interface CostoBOMResult {
  lineas: LineaCostoBOM[];
  operaciones: OperacionBOM[];
  costoMateriales: number;
  costoOperaciones: number;
  costoTotal: number;
  unidades: number;
}

/**
 * Calcula el costo completo de producir `unidades` del producto.
 * Recibe el BOM y el mapa de materiales ya cargados (sin IO).
 * Exportada para tests unitarios.
 */
export function calcularCostoBOM(
  bom: Pick<BOM, 'lineas' | 'operaciones'>,
  materialesPorId: Record<string, Pick<Material, 'nombre' | 'costoUnitario'>>,
  unidades: number,
): CostoBOMResult {
  if (unidades <= 0) throw new RangeError('unidades debe ser > 0');

  let costoMateriales = new Decimal(0);

  const lineas: LineaCostoBOM[] = bom.lineas.map((linea) => {
    const material = materialesPorId[linea.materialId];
    const nombreMaterial = material?.nombre ?? `[${linea.materialId}]`;
    const costoUnitarioMaterial = material?.costoUnitario ?? 0;

    const cantidadConMerma = calcularCantidadConMerma(
      linea.cantidadBase,
      linea.factorMerma,
      unidades,
    );

    const costoLinea = new Decimal(cantidadConMerma)
      .times(costoUnitarioMaterial)
      .toDecimalPlaces(6)
      .toNumber();

    costoMateriales = costoMateriales.plus(costoLinea);

    return {
      materialId: linea.materialId,
      nombreMaterial,
      cantidadBase: linea.cantidadBase,
      factorMerma: linea.factorMerma,
      cantidadConMerma,
      costoUnitarioMaterial,
      costoLinea,
    };
  });

  let costoOperaciones = new Decimal(0);
  for (const op of bom.operaciones) {
    const costoOp = new Decimal(op.minutos)
      .times(op.costoPorMinuto)
      .times(unidades)
      .toDecimalPlaces(6);
    costoOperaciones = costoOperaciones.plus(costoOp);
  }

  return {
    lineas,
    operaciones: bom.operaciones,
    costoMateriales: costoMateriales.toDecimalPlaces(4).toNumber(),
    costoOperaciones: costoOperaciones.toDecimalPlaces(4).toNumber(),
    costoTotal: costoMateriales
      .plus(costoOperaciones)
      .toDecimalPlaces(4)
      .toNumber(),
    unidades,
  };
}

// ─────────────────────────────────────────────
// validarDisponibilidadBOM (pura — recibe stocks ya cargados)
// ─────────────────────────────────────────────

export interface ItemFaltante {
  materialId: string;
  requerido: number;
  disponible: number;
  deficit: number;
}

export interface ValidacionDisponibilidadResult {
  valido: boolean;
  faltantes: ItemFaltante[];
}

/**
 * Verifica si hay stock suficiente para producir `unidades`.
 * Recibe el BOM y el mapa de stocks ya cargados (sin IO).
 * Exportada para tests unitarios.
 */
export function validarDisponibilidadBOM(
  bom: Pick<BOM, 'lineas'>,
  stockPorMaterialId: Record<string, Pick<Stock, 'cantidadDisponible'>>,
  unidades: number,
): ValidacionDisponibilidadResult {
  const faltantes: ItemFaltante[] = [];

  for (const linea of bom.lineas) {
    const requerido = calcularCantidadConMerma(
      linea.cantidadBase,
      linea.factorMerma,
      unidades,
    );
    const disponible = stockPorMaterialId[linea.materialId]?.cantidadDisponible ?? 0;

    if (new Decimal(requerido).greaterThan(disponible)) {
      faltantes.push({
        materialId: linea.materialId,
        requerido,
        disponible,
        deficit: new Decimal(requerido)
          .minus(disponible)
          .toDecimalPlaces(6)
          .toNumber(),
      });
    }
  }

  return { valido: faltantes.length === 0, faltantes };
}

// ─────────────────────────────────────────────
// Funciones con IO (Postgres vía supabaseAdmin)
// Solo se llaman desde bom.service internamente o desde API Routes.
// ─────────────────────────────────────────────

/** Carga el BOM de un producto (boms + bom_lineas + bom_operaciones en un solo round trip). */
export async function cargarBOM(productoId: string): Promise<BOM> {
  const { data, error } = await supabaseAdmin
    .from('boms')
    .select('producto_id, version, costo_materiales, costo_operaciones, costo_total, actualizado_en, bom_lineas(*), bom_operaciones(*)')
    .eq('producto_id', productoId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new BOMNoEncontradoError(productoId);

  const lineas: LineaBOM[] = [...data.bom_lineas]
    .sort((a, b) => a.orden - b.orden)
    .map((l) => ({
      materialId: l.material_id,
      cantidadBase: Number(l.cantidad_base),
      factorMerma: Number(l.factor_merma),
      cantidadConMerma: Number(l.cantidad_con_merma),
      unidadId: l.unidad_id,
      notas: l.notas,
    }));

  const operaciones: OperacionBOM[] = [...data.bom_operaciones]
    .sort((a, b) => a.orden - b.orden)
    .map((o) => ({
      tipo: o.tipo,
      minutos: Number(o.minutos),
      costoPorMinuto: Number(o.costo_por_minuto),
      costoTotal: Number(o.costo_total),
    }));

  return {
    productoId: data.producto_id,
    version: data.version,
    lineas,
    operaciones,
    costoMateriales: Number(data.costo_materiales),
    costoOperaciones: Number(data.costo_operaciones),
    costoTotal: Number(data.costo_total),
    actualizadoEn: data.actualizado_en,
  };
}

/** Carga los stocks de todos los materiales del BOM en un solo round trip. */
export async function cargarStocksBOM(
  lineas: LineaBOM[],
): Promise<Record<string, Stock>> {
  const materialIds = [...new Set(lineas.map((l) => l.materialId))];
  if (materialIds.length === 0) return {};

  const { data, error } = await supabaseAdmin
    .from('stock')
    .select('*')
    .in('material_id', materialIds);
  if (error) throw error;

  const stockPorId: Record<string, Stock> = {};
  for (const row of data ?? []) stockPorId[row.material_id] = mapStockRow(row);
  return stockPorId;
}

/** Carga los materiales del BOM (para costos). Un solo round trip — sin el límite de 10 de Firestore. */
export async function cargarMaterialesBOM(
  lineas: LineaBOM[],
): Promise<Record<string, Material>> {
  const materialIds = [...new Set(lineas.map((l) => l.materialId))];
  if (materialIds.length === 0) return {};

  const { data, error } = await supabaseAdmin
    .from('materiales')
    .select('*')
    .in('id', materialIds);
  if (error) throw error;

  const result: Record<string, Material> = {};
  for (const row of data ?? []) result[row.id] = mapMaterialRow(row);
  return result;
}

// ─────────────────────────────────────────────
// calcularCostoProducto (IO — para API Route)
// ─────────────────────────────────────────────

/**
 * Carga BOM + materiales y calcula el costo completo.
 * Punto de entrada para API Routes.
 */
export async function calcularCostoProducto(
  productoId: string,
  unidades: number,
): Promise<CostoBOMResult> {
  const bom = await cargarBOM(productoId);
  const materiales = await cargarMaterialesBOM(bom.lineas);
  return calcularCostoBOM(bom, materiales, unidades);
}

// ─────────────────────────────────────────────
// reservarMaterialesBOM (IO — RPC `reservar_materiales_bom`)
// ─────────────────────────────────────────────

/**
 * Reserva los materiales del BOM de `productoId` para una OP, vía la función
 * plpgsql `reservar_materiales_bom` (row-locking real con `SELECT ... FOR UPDATE`).
 * Todo-o-nada: si cualquier material tiene stock insuficiente, la función revierte
 * todo lo hecho en esa invocación (no se modifica nada en la base).
 */
export async function reservarMaterialesBOM(
  productoId: string,
  unidades: number,
  ordenId: string,
  usuarioId: string,
): Promise<MaterialReservado[]> {
  const { data, error } = await supabaseAdmin.rpc('reservar_materiales_bom', {
    p_orden_id: ordenId,
    p_producto_id: productoId,
    p_unidades: unidades,
    p_usuario_id: usuarioId,
  });
  if (error) throwBomRpcError(error);

  return (data as Array<{ materialId: string; cantidadReservada: number; costoUnitarioAlMomento: number }>);
}

// ─────────────────────────────────────────────
// liberarMaterialesBOM (para CANCELAR una OP)
// ─────────────────────────────────────────────

/** Libera la reserva de materiales de una OP cuando se cancela (RPC `liberar_materiales_bom`). */
export async function liberarMaterialesBOM(
  ordenId: string,
  usuarioId: string,
): Promise<void> {
  const { error } = await supabaseAdmin.rpc('liberar_materiales_bom', {
    p_orden_id: ordenId,
    p_usuario_id: usuarioId,
  });
  if (error) throwBomRpcError(error);
}

// ─────────────────────────────────────────────
// consumirMaterialesBOM (para COMPLETAR una OP)
// ─────────────────────────────────────────────

/** Convierte la reserva de una OP en consumo definitivo (RPC `consumir_materiales_bom`). */
export async function consumirMaterialesBOM(
  ordenId: string,
  usuarioId: string,
): Promise<void> {
  const { error } = await supabaseAdmin.rpc('consumir_materiales_bom', {
    p_orden_id: ordenId,
    p_usuario_id: usuarioId,
  });
  if (error) throwBomRpcError(error);
}
