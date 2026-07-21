/**
 * mappers.ts — traduce filas de Postgres (snake_case) a los tipos de dominio de la
 * app (camelCase, definidos en types/metalmac.types.ts). Mantiene ese archivo estable
 * como el contrato que ya consumen componentes/hooks, sin propagar snake_case fuera
 * de la capa de servicios.
 */
import type { Database } from '@/types/supabase.types';
import type { Material, Stock, MovimientoInventario } from '@/types/metalmac.types';

type MaterialRow = Database['public']['Tables']['materiales']['Row'];
type StockRow = Database['public']['Tables']['stock']['Row'];
type MovimientoRow = Database['public']['Tables']['movimientos_inventario']['Row'];

export function mapMaterialRow(row: MaterialRow): Material {
  return {
    id: row.id,
    codigoInterno: row.codigo_interno,
    nombre: row.nombre,
    descripcion: row.descripcion,
    tipo: row.tipo,
    categoriaId: row.categoria_id,
    grado: row.grado,
    unidadBaseId: row.unidad_base_id,
    costoUnitario: Number(row.costo_unitario),
    especificaciones: row.especificaciones as Material['especificaciones'],
    activo: row.activo,
    creadoEn: row.creado_en,
    modificadoEn: row.modificado_en,
  };
}

export function mapStockRow(row: StockRow): Stock {
  return {
    materialId: row.material_id,
    cantidadDisponible: Number(row.cantidad_disponible),
    cantidadReservada: Number(row.cantidad_reservada),
    cantidadMinima: Number(row.cantidad_minima),
    cantidadMaxima: row.cantidad_maxima === null ? null : Number(row.cantidad_maxima),
    ubicacion: row.ubicacion,
    actualizadoEn: row.actualizado_en,
  };
}

export function mapMovimientoRow(row: MovimientoRow): MovimientoInventario {
  return {
    id: row.id,
    materialId: row.material_id,
    tipo: row.tipo,
    cantidad: Number(row.cantidad),
    stockAnterior: Number(row.stock_anterior),
    stockPosterior: Number(row.stock_posterior),
    costoUnitario: Number(row.costo_unitario),
    documentoTipo: row.documento_tipo,
    documentoId: row.documento_id,
    numeroReferencia: row.numero_referencia,
    notas: row.notas,
    usuarioId: row.usuario_id,
    fecha: row.fecha,
  };
}
