/**
 * bom.service.ts — Lógica de BOM (Bill of Materials) y Órdenes de Producción
 *
 * Reglas críticas:
 * - TODA aritmética usa decimal.js (nunca Number para costos o cantidades)
 * - cantidadConMerma = cantidadBase * factorMerma (aplicado por línea, no globalmente)
 * - reservarMaterialesBOM usa runTransaction — nunca actualiza stock fuera de transacción
 * - generarCodigoOP usa un counter en Firestore dentro de transacción para garantizar secuencialidad
 * - Al COMPLETAR una OP: RESERVA → SALIDA (consume), libera lo no consumido
 * - Al CANCELAR una OP: RESERVA → LIBERACION (devuelve al disponible)
 *
 * Usa Admin SDK (server-only) — llamado exclusivamente desde API Routes.
 * Las reglas de Firestore exigen `isAuth()` para leer y `allow write: if false`
 * en /stock y /movimientos_inventario, así que estas escrituras SOLO pueden
 * hacerse con el Admin SDK (que ignora las reglas de seguridad).
 */

import { FieldValue, DocumentReference } from 'firebase-admin/firestore';
import Decimal from 'decimal.js';
import { adminDb } from '@/lib/firebase-admin';
import type {
  BOM,
  LineaBOM,
  OperacionBOM,
  Material,
  Stock,
  OrdenProduccion,
  MaterialReservado,
} from '@/types/metalmac.types';

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
// Funciones con IO (Firestore Admin SDK)
// Solo se llaman desde bom.service internamente o desde API Routes.
// ─────────────────────────────────────────────

/** Carga el BOM de un producto desde Firestore. */
export async function cargarBOM(productoId: string): Promise<BOM> {
  const snap = await adminDb.collection('bom').doc(productoId).get();
  if (!snap.exists) throw new BOMNoEncontradoError(productoId);
  return { productoId, ...snap.data() } as BOM;
}

/** Carga los stocks de todos los materiales del BOM en una sola operación paralela. */
export async function cargarStocksBOM(
  lineas: LineaBOM[],
): Promise<Record<string, Stock>> {
  const materialIds = [...new Set(lineas.map((l) => l.materialId))];
  const stockPorId: Record<string, Stock> = {};

  await Promise.all(
    materialIds.map(async (id) => {
      const snap = await adminDb.collection('stock').doc(id).get();
      if (snap.exists) {
        stockPorId[id] = { materialId: id, ...snap.data() } as Stock;
      }
    }),
  );

  return stockPorId;
}

/** Carga los materiales del BOM (para costos). Firestore whereIn ≤ 10 — batch interno. */
export async function cargarMaterialesBOM(
  lineas: LineaBOM[],
): Promise<Record<string, Material>> {
  const materialIds = [...new Set(lineas.map((l) => l.materialId))];
  const result: Record<string, Material> = {};

  // Lotes de 10 por límite de whereIn en Firestore
  const BATCH = 10;
  for (let i = 0; i < materialIds.length; i += BATCH) {
    const batch = materialIds.slice(i, i + BATCH);
    const snap = await adminDb
      .collection('materiales')
      .where('__name__', 'in', batch)
      .get();
    snap.docs.forEach((d) => { result[d.id] = { id: d.id, ...d.data() } as Material; });
  }

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
// reservarMaterialesBOM (IO — Firestore Transaction)
// ─────────────────────────────────────────────

/**
 * Dentro de una transacción Firestore:
 * 1. Verifica disponibilidad de cada material
 * 2. Reduce cantidadDisponible y sube cantidadReservada (tipo RESERVA)
 * 3. Crea un movimiento_inventario por cada material
 *
 * Lanza StockInsuficienteParaOPError en el primer material con stock insuficiente.
 * Al lanzar, la transacción se aborta y no se modifica nada en Firestore.
 */
export async function reservarMaterialesBOM(
  bom: BOM,
  unidades: number,
  ordenId: string,
  usuarioId: string,
): Promise<MaterialReservado[]> {
  const materialesReservados: MaterialReservado[] = [];

  await adminDb.runTransaction(async (transaction) => {
    // 1. Leer todos los stocks dentro de la transacción
    const stockRefs = bom.lineas.map((l) => adminDb.collection('stock').doc(l.materialId));
    const stockSnaps = await Promise.all(stockRefs.map((r) => transaction.get(r)));

    const stockPorId: Record<string, { disponible: Decimal; reservada: Decimal; costoUnitario: number }> = {};

    for (let i = 0; i < bom.lineas.length; i++) {
      const linea = bom.lineas[i];
      const snap = stockSnaps[i];

      if (!snap.exists) {
        throw new StockInsuficienteParaOPError(linea.materialId, 0, 0);
      }

      const data = snap.data()!;
      stockPorId[linea.materialId] = {
        disponible: new Decimal(data.cantidadDisponible),
        reservada: new Decimal(data.cantidadReservada),
        costoUnitario: data.costoUnitario ?? 0,
      };
    }

    // 2. Verificar disponibilidad y preparar escrituras
    const escrituras: Array<{ stockRef: DocumentReference; nuevaDisponible: Decimal; nuevaReservada: Decimal; cantidad: number; costoUnitario: number; materialId: string }> = [];

    for (const linea of bom.lineas) {
      const requerido = calcularCantidadConMerma(
        linea.cantidadBase,
        linea.factorMerma,
        unidades,
      );
      const { disponible, reservada, costoUnitario } = stockPorId[linea.materialId];

      if (new Decimal(requerido).greaterThan(disponible)) {
        throw new StockInsuficienteParaOPError(
          linea.materialId,
          requerido,
          disponible.toNumber(),
        );
      }

      escrituras.push({
        materialId: linea.materialId,
        stockRef: adminDb.collection('stock').doc(linea.materialId),
        nuevaDisponible: disponible.minus(requerido),
        nuevaReservada: reservada.plus(requerido),
        cantidad: requerido,
        costoUnitario,
      });
    }

    // 3. Escribir stock + movimientos
    for (const e of escrituras) {
      const movRef = adminDb.collection('movimientos_inventario').doc();

      transaction.update(e.stockRef, {
        cantidadDisponible: e.nuevaDisponible.toNumber(),
        cantidadReservada: e.nuevaReservada.toNumber(),
        actualizadoEn: FieldValue.serverTimestamp(),
      });

      transaction.set(movRef, {
        materialId: e.materialId,
        tipo: 'RESERVA',
        cantidad: e.cantidad,
        stockAnterior: e.nuevaDisponible.plus(e.cantidad).toNumber(),
        stockPosterior: e.nuevaDisponible.toNumber(),
        costoUnitario: e.costoUnitario,
        documentoTipo: 'ORDEN_PRODUCCION',
        documentoId: ordenId,
        numeroReferencia: ordenId,
        notas: `Reserva para OP ${ordenId}`,
        usuarioId,
        fecha: FieldValue.serverTimestamp(),
      });

      materialesReservados.push({
        materialId: e.materialId,
        cantidadReservada: e.cantidad,
        costoUnitarioAlMomento: e.costoUnitario,
      });
    }
  });

  return materialesReservados;
}

// ─────────────────────────────────────────────
// liberarMaterialesBOM (para CANCELAR una OP)
// ─────────────────────────────────────────────

/**
 * Libera la reserva de materiales cuando una OP se cancela.
 * Tipo LIBERACION: mueve cantidadReservada → cantidadDisponible.
 */
export async function liberarMaterialesBOM(
  materialesReservados: MaterialReservado[],
  ordenId: string,
  usuarioId: string,
): Promise<void> {
  await adminDb.runTransaction(async (transaction) => {
    for (const mr of materialesReservados) {
      const stockRef = adminDb.collection('stock').doc(mr.materialId);
      const snap = await transaction.get(stockRef);
      if (!snap.exists) continue;

      const data = snap.data()!;
      const disponible = new Decimal(data.cantidadDisponible);
      const reservada = new Decimal(data.cantidadReservada);
      // Liberar lo que realmente está reservado (no más de lo reservado)
      const aLiberar = Decimal.min(mr.cantidadReservada, reservada);

      transaction.update(stockRef, {
        cantidadDisponible: disponible.plus(aLiberar).toNumber(),
        cantidadReservada: reservada.minus(aLiberar).toNumber(),
        actualizadoEn: FieldValue.serverTimestamp(),
      });

      const movRef = adminDb.collection('movimientos_inventario').doc();
      transaction.set(movRef, {
        materialId: mr.materialId,
        tipo: 'LIBERACION',
        cantidad: aLiberar.toNumber(),
        stockAnterior: disponible.toNumber(),
        stockPosterior: disponible.plus(aLiberar).toNumber(),
        costoUnitario: mr.costoUnitarioAlMomento,
        documentoTipo: 'ORDEN_PRODUCCION',
        documentoId: ordenId,
        numeroReferencia: ordenId,
        notas: `Liberación por cancelación de OP ${ordenId}`,
        usuarioId,
        fecha: FieldValue.serverTimestamp(),
      });
    }
  });
}

// ─────────────────────────────────────────────
// consumirMaterialesBOM (para COMPLETAR una OP)
// ─────────────────────────────────────────────

/**
 * Al completar una OP: convierte RESERVA → SALIDA definitiva.
 * Reduce cantidadReservada (la reserva existente) y registra movimiento tipo SALIDA.
 */
export async function consumirMaterialesBOM(
  materialesReservados: MaterialReservado[],
  ordenId: string,
  usuarioId: string,
): Promise<void> {
  await adminDb.runTransaction(async (transaction) => {
    for (const mr of materialesReservados) {
      const stockRef = adminDb.collection('stock').doc(mr.materialId);
      const snap = await transaction.get(stockRef);
      if (!snap.exists) continue;

      const data = snap.data()!;
      const reservada = new Decimal(data.cantidadReservada);
      const aConsumir = Decimal.min(mr.cantidadReservada, reservada);

      transaction.update(stockRef, {
        cantidadReservada: reservada.minus(aConsumir).toNumber(),
        actualizadoEn: FieldValue.serverTimestamp(),
      });

      const movRef = adminDb.collection('movimientos_inventario').doc();
      transaction.set(movRef, {
        materialId: mr.materialId,
        tipo: 'SALIDA',
        cantidad: aConsumir.toNumber(),
        stockAnterior: new Decimal(data.cantidadDisponible).toNumber(),
        stockPosterior: new Decimal(data.cantidadDisponible).toNumber(), // disponible ya se redujo en RESERVA
        costoUnitario: mr.costoUnitarioAlMomento,
        documentoTipo: 'ORDEN_PRODUCCION',
        documentoId: ordenId,
        numeroReferencia: ordenId,
        notas: `Consumo al completar OP ${ordenId}`,
        usuarioId,
        fecha: FieldValue.serverTimestamp(),
      });
    }
  });
}
