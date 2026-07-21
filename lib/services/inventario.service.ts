/**
 * inventario.service.ts
 *
 * Lógica de negocio de inventario para MetalMAC ERP.
 * Todas las operaciones que modifican /stock/{id} DEBEN usar runTransaction.
 * Usa decimal.js para aritmética monetaria y de cantidades (sin pérdida de precisión).
 *
 * Usa Admin SDK (server-only) — llamado exclusivamente desde API Routes.
 * Las reglas de Firestore exigen `isAuth()` para leer y `allow write: if false`
 * en /stock y /movimientos_inventario, así que estas escrituras SOLO pueden
 * hacerse con el Admin SDK (que ignora las reglas de seguridad).
 */

import { FieldValue } from 'firebase-admin/firestore';
import Decimal from 'decimal.js';
import { adminDb } from '../firebase-admin';
import type {
  MovimientoInput,
  MovimientoInventario,
  Stock,
  Material,
  TablaEquivalencia,
  TipoMovimiento,
} from '../../types/metalmac.types';
import {
  StockInsuficienteError,
  MaterialNoEncontradoError,
} from '../../types/metalmac.types';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos que reducen stock (salidas y reservas)
// ─────────────────────────────────────────────────────────────────────────────

const TIPOS_SALIDA: ReadonlySet<TipoMovimiento> = new Set([
  'SALIDA',
  'AJUSTE_NEGATIVO',
  'RESERVA',
  'MERMA',
]);

const TIPOS_ENTRADA: ReadonlySet<TipoMovimiento> = new Set([
  'ENTRADA',
  'AJUSTE_POSITIVO',
  'LIBERACION',
  'DEVOLUCION',
]);

// ─────────────────────────────────────────────────────────────────────────────
// registrarMovimiento
//
// Registra un movimiento de inventario DENTRO de una Firestore Transaction para
// garantizar consistencia entre /stock/{materialId} y /movimientos_inventario/{id}.
//
// Lanza StockInsuficienteError si el tipo es de salida y no hay stock suficiente.
// Lanza MaterialNoEncontradoError si el documento /stock/{materialId} no existe.
// ─────────────────────────────────────────────────────────────────────────────

export async function registrarMovimiento(input: MovimientoInput): Promise<string> {
  const stockRef = adminDb.collection('stock').doc(input.materialId);
  const nuevoMovimientoRef = adminDb.collection('movimientos_inventario').doc(); // pre-generar ID

  await adminDb.runTransaction(async (transaction) => {
    const stockSnap = await transaction.get(stockRef);

    if (!stockSnap.exists) {
      throw new MaterialNoEncontradoError(input.materialId);
    }

    const stockData = stockSnap.data()! as Omit<Stock, 'materialId'>;
    const disponibleActual = new Decimal(stockData.cantidadDisponible);
    const reservadaActual  = new Decimal(stockData.cantidadReservada);
    const cantidadMov      = new Decimal(input.cantidad);

    if (cantidadMov.lte(0)) {
      throw new RangeError(`La cantidad debe ser mayor a 0. Recibido: ${input.cantidad}`);
    }

    let nuevaDisponible: Decimal = disponibleActual;
    let nuevaReservada: Decimal  = reservadaActual;

    if (TIPOS_SALIDA.has(input.tipo)) {
      // Para RESERVA: mueve de disponible → reservada (no reduce el total)
      if (input.tipo === 'RESERVA') {
        if (disponibleActual.lt(cantidadMov)) {
          throw new StockInsuficienteError(
            input.materialId,
            disponibleActual.toNumber(),
            cantidadMov.toNumber(),
          );
        }
        nuevaDisponible = disponibleActual.minus(cantidadMov);
        nuevaReservada  = reservadaActual.plus(cantidadMov);
      } else {
        // SALIDA, AJUSTE_NEGATIVO, MERMA: reduce disponible
        if (disponibleActual.lt(cantidadMov)) {
          throw new StockInsuficienteError(
            input.materialId,
            disponibleActual.toNumber(),
            cantidadMov.toNumber(),
          );
        }
        nuevaDisponible = disponibleActual.minus(cantidadMov);
      }
    } else if (TIPOS_ENTRADA.has(input.tipo)) {
      if (input.tipo === 'LIBERACION') {
        // Libera de reservada → disponible
        const liberacion = Decimal.min(cantidadMov, reservadaActual);
        nuevaReservada  = reservadaActual.minus(liberacion);
        nuevaDisponible = disponibleActual.plus(liberacion);
      } else {
        // ENTRADA, AJUSTE_POSITIVO, DEVOLUCION: aumenta disponible
        nuevaDisponible = disponibleActual.plus(cantidadMov);
      }
    }

    // Actualizar stock
    transaction.update(stockRef, {
      cantidadDisponible: nuevaDisponible.toNumber(),
      cantidadReservada:  nuevaReservada.toNumber(),
      actualizadoEn: FieldValue.serverTimestamp(),
    });

    // Crear movimiento
    const movimiento: Omit<MovimientoInventario, 'id'> = {
      materialId:       input.materialId,
      tipo:             input.tipo,
      cantidad:         cantidadMov.toNumber(),
      stockAnterior:    disponibleActual.toNumber(),
      stockPosterior:   nuevaDisponible.toNumber(),
      costoUnitario:    new Decimal(input.costoUnitario).toNumber(),
      documentoTipo:    input.documentoTipo,
      documentoId:      input.documentoId ?? null,
      numeroReferencia: input.numeroReferencia,
      notas:            input.notas ?? '',
      usuarioId:        input.usuarioId,
      fecha:            FieldValue.serverTimestamp() as unknown as MovimientoInventario['fecha'],
    };

    transaction.set(nuevoMovimientoRef, movimiento);
  });

  return nuevoMovimientoRef.id;
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
// Lee /stock (query) y luego /materiales para obtener nombre/codigo.
//
// Estrategia: dos queries paralelas por batch de 10 (límite where-in Firestore).
// ─────────────────────────────────────────────────────────────────────────────

export async function obtenerAlertasStockBajo(): Promise<AlertaStockBajo[]> {
  // 1. Obtener todos los documentos de stock
  const stockSnap = await adminDb.collection('stock').get();

  // 2. Filtrar los que están bajo mínimo
  const stocksBajos = stockSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Stock, 'materialId'>) }))
    .filter((s) => s.cantidadDisponible < s.cantidadMinima);

  if (stocksBajos.length === 0) return [];

  // 3. Obtener los materiales correspondientes (en batches de 10 — límite whereIn)
  const materialIds = stocksBajos.map((s) => s.id);
  const materiales  = await fetchMaterialesByIds(materialIds);
  const materialesMap = new Map(materiales.map((m) => [m.id, m]));

  // 4. Construir alertas
  return stocksBajos.map((s) => ({
    material: materialesMap.get(s.id) ?? null,
    materialId: s.id,
    cantidadDisponible: s.cantidadDisponible,
    cantidadMinima: s.cantidadMinima,
    diferencia: new Decimal(s.cantidadMinima)
      .minus(s.cantidadDisponible)
      .toNumber(),
    ubicacion: s.ubicacion,
  }));
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

// ─────────────────────────────────────────────────────────────────────────────
// Utilidades internas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch materiales por IDs en batches de 10 (restricción whereIn Firestore).
 */
async function fetchMaterialesByIds(ids: string[]): Promise<Material[]> {
  const results: Material[] = [];
  const BATCH_SIZE = 10;

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE);
    const snap = await adminDb
      .collection('materiales')
      .where('__name__', 'in', batch)
      .get();
    snap.docs.forEach((d) => results.push({ id: d.id, ...d.data() } as Material));
  }

  return results;
}
