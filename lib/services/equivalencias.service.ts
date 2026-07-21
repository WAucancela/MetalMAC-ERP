/**
 * equivalencias.service.ts — Resolución de líneas XML contra tabla_equivalencias
 *
 * Estrategia de resolución (en orden de prioridad):
 * 1. Coincidencia exacta por codigoProveedor
 * 2. Coincidencia exacta por codigoAdicional del proveedor
 * 3. Coincidencia parcial por descripción (case-insensitive)
 * 4. No resuelta → materialId = null, resuelta = false
 *
 * Usa el cliente service_role (server-only) — llamado exclusivamente desde API Routes.
 * decimal.js para conversión de cantidades (evita errores de punto flotante).
 */

import Decimal from 'decimal.js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { LineaXML, LineaResuelta, TablaEquivalencia } from '@/types/metalmac.types';

// ─────────────────────────────────────────────
// obtenerEquivalenciasProveedor
// ─────────────────────────────────────────────

/**
 * Carga todas las equivalencias activas de un proveedor.
 * Una sola query por llamada a resolverLineasFactura.
 */
async function obtenerEquivalenciasProveedor(
  proveedorId: string,
): Promise<TablaEquivalencia[]> {
  const { data, error } = await supabaseAdmin
    .from('tabla_equivalencias')
    .select('*')
    .eq('proveedor_id', proveedorId)
    .eq('activo', true);
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    proveedorId: row.proveedor_id,
    codigoProveedor: row.codigo_proveedor,
    descripcionProveedor: row.descripcion_proveedor,
    materialId: row.material_id,
    unidadProveedorId: row.unidad_proveedor_id,
    factorConversion: Number(row.factor_conversion),
    precioReferencia: Number(row.precio_referencia),
    activo: row.activo,
  }));
}

// ─────────────────────────────────────────────
// resolverLineaContra (lógica pura, sin IO)
// ─────────────────────────────────────────────

/**
 * Intenta resolver una línea XML contra el catálogo de equivalencias.
 * Exportada para tests unitarios (sin Firestore).
 */
export function resolverLineaContra(
  linea: LineaXML,
  equivalencias: TablaEquivalencia[],
): LineaResuelta {
  // 1. Coincidencia exacta por codigoInterno (codigoPrincipal del XML)
  let match = equivalencias.find(
    (e) => e.codigoProveedor === linea.codigoInterno,
  );

  // 2. Coincidencia exacta por codigoAdicional
  if (!match && linea.codigoAdicional) {
    match = equivalencias.find(
      (e) => e.codigoProveedor === linea.codigoAdicional,
    );
  }

  // 3. Coincidencia parcial por descripción (case-insensitive)
  //    Se omite si la descripción está vacía: de lo contrario `eqNorm.includes('')`
  //    siempre es true y emparejaría con la primera equivalencia de la lista.
  if (!match) {
    const descNorm = linea.descripcion.toLowerCase().trim();
    if (descNorm.length > 0) {
      match = equivalencias.find((e) => {
        const eqNorm = e.descripcionProveedor.toLowerCase().trim();
        return eqNorm.length > 0 && (descNorm.includes(eqNorm) || eqNorm.includes(descNorm));
      });
    }
  }

  if (!match) {
    return {
      ...linea,
      materialId: null,
      cantidadConvertida: null,
      factorConversion: null,
      equivalenciaId: null,
      resuelta: false,
    };
  }

  // Convertir cantidad usando decimal.js para evitar errores de punto flotante
  const cantidadConvertida = new Decimal(linea.cantidad)
    .times(new Decimal(match.factorConversion))
    .toDecimalPlaces(6)
    .toNumber();

  return {
    ...linea,
    materialId: match.materialId,
    cantidadConvertida,
    factorConversion: match.factorConversion,
    equivalenciaId: match.id,
    resuelta: true,
  };
}

// ─────────────────────────────────────────────
// resolverLineasFactura (punto de entrada principal)
// ─────────────────────────────────────────────

export interface ResolucionResult {
  lineas: LineaResuelta[];
  totalLineas: number;
  lineasResueltas: number;
  lineasSinResolver: number;
  porcentajeResolucion: number;
}

/**
 * Carga las equivalencias del proveedor desde Firestore (Admin SDK)
 * y resuelve todas las líneas. Devuelve estadísticas junto con las líneas enriquecidas.
 */
export async function resolverLineasFactura(
  proveedorId: string,
  lineas: LineaXML[],
): Promise<ResolucionResult> {
  const equivalencias = await obtenerEquivalenciasProveedor(proveedorId);

  const lineasResueltas = lineas.map((linea) =>
    resolverLineaContra(linea, equivalencias),
  );

  const resueltas = lineasResueltas.filter((l) => l.resuelta).length;

  return {
    lineas: lineasResueltas,
    totalLineas: lineas.length,
    lineasResueltas: resueltas,
    lineasSinResolver: lineas.length - resueltas,
    porcentajeResolucion:
      lineas.length > 0
        ? new Decimal(resueltas)
            .dividedBy(lineas.length)
            .times(100)
            .toDecimalPlaces(1)
            .toNumber()
        : 0,
  };
}

// ─────────────────────────────────────────────
// construirEquivalencia (helper para el flujo de aprendizaje)
// ─────────────────────────────────────────────

/**
 * Construye el objeto a guardar en tabla_equivalencias cuando el usuario
 * confirma manualmente qué material corresponde a una línea sin resolver.
 * La escritura la hace el API Route con Admin SDK.
 */
export function construirEquivalencia(
  proveedorId: string,
  linea: LineaXML,
  materialId: string,
  factorConversion: number,
): Omit<TablaEquivalencia, 'id'> {
  return {
    proveedorId,
    codigoProveedor: linea.codigoInterno || linea.codigoAdicional,
    descripcionProveedor: linea.descripcion,
    materialId,
    unidadProveedorId: '',
    factorConversion,
    precioReferencia: linea.precioUnitario,
    activo: true,
  };
}
