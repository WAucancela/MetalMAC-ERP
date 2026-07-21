/**
 * mappers.ts — traduce filas de Postgres (snake_case) a los tipos de dominio de la
 * app (camelCase, definidos en types/metalmac.types.ts). Mantiene ese archivo estable
 * como el contrato que ya consumen componentes/hooks, sin propagar snake_case fuera
 * de la capa de servicios.
 */
import type { Database } from '@/types/supabase.types';
import type {
  Material, Stock, MovimientoInventario, Producto, Proveedor, OrdenProduccion, MaterialReservado, Proyecto,
  GastoProyecto, FacturaCompra, LineaFacturaCompra, Retencion,
} from '@/types/metalmac.types';

type MaterialRow = Database['public']['Tables']['materiales']['Row'];
type StockRow = Database['public']['Tables']['stock']['Row'];
type MovimientoRow = Database['public']['Tables']['movimientos_inventario']['Row'];
type ProductoRow = Database['public']['Tables']['productos']['Row'];
type ProveedorRow = Database['public']['Tables']['proveedores']['Row'];
type OrdenRow = Database['public']['Tables']['ordenes_produccion']['Row'];
type OrdenMaterialReservadoRow = Database['public']['Tables']['orden_materiales_reservados']['Row'];
type ProyectoRow = Database['public']['Tables']['proyectos']['Row'];
type GastoProyectoRow = Database['public']['Tables']['gastos_proyecto']['Row'];
type FacturaCompraRow = Database['public']['Tables']['facturas_compra']['Row'];
type FacturaCompraLineaRow = Database['public']['Tables']['factura_compra_lineas']['Row'];
type FacturaCompraRetencionRow = Database['public']['Tables']['factura_compra_retenciones']['Row'];

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

export function mapProductoRow(row: ProductoRow): Producto {
  return {
    id: row.id,
    codigo: row.codigo,
    nombre: row.nombre,
    descripcion: row.descripcion,
    tipo: row.tipo,
    unidadVenta: row.unidad_venta,
    precioVenta: Number(row.precio_venta),
    activo: row.activo,
  };
}

export function mapProveedorRow(row: ProveedorRow): Proveedor {
  return {
    id: row.id,
    ruc: row.ruc,
    razonSocial: row.razon_social,
    nombreComercial: row.nombre_comercial,
    tipoContribuyente: row.tipo_contribuyente,
    contribuyenteEspecial: row.contribuyente_especial,
    obligaContabilidad: row.obliga_contabilidad,
    agenteRetencion: row.agente_retencion,
    diasCredito: row.dias_credito,
    telefonoPrincipal: row.telefono_principal,
    emailPrincipal: row.email_principal,
    ciudad: row.ciudad,
    activo: row.activo,
  };
}

export function mapOrdenProduccionRow(
  row: OrdenRow,
  materialesReservados: OrdenMaterialReservadoRow[] = [],
): OrdenProduccion {
  return {
    id: row.id,
    codigo: row.codigo,
    productoId: row.producto_id,
    cantidad: Number(row.cantidad),
    estado: row.estado,
    fechaInicio: row.fecha_inicio,
    fechaEntrega: row.fecha_entrega,
    costoEstimado: Number(row.costo_estimado),
    costoReal: row.costo_real === null ? null : Number(row.costo_real),
    fechaCompletada: row.fecha_completada,
    proyectoId: row.proyecto_id,
    notas: row.notas,
    materialesReservados: materialesReservados.map((mr): MaterialReservado => ({
      materialId: mr.material_id,
      cantidadReservada: Number(mr.cantidad_reservada),
      costoUnitarioAlMomento: Number(mr.costo_unitario_al_momento),
    })),
    creadoEn: row.creado_en,
  };
}

export function mapProyectoRow(row: ProyectoRow): Proyecto {
  return {
    id: row.id,
    codigo: row.codigo,
    nombre: row.nombre,
    descripcion: row.descripcion,
    cliente: row.cliente,
    presupuesto: Number(row.presupuesto),
    costoEstimado: Number(row.costo_estimado),
    costoReal: Number(row.costo_real),
    estado: row.estado,
    fechaInicio: row.fecha_inicio,
    fechaFin: row.fecha_fin,
    responsableId: row.responsable_id,
    creadoEn: row.creado_en,
    creadoPor: row.creado_por,
    actualizadoEn: row.actualizado_en,
    actualizadoPor: row.actualizado_por ?? row.creado_por,
  };
}

export function mapGastoProyectoRow(row: GastoProyectoRow): GastoProyecto {
  return {
    id: row.id,
    proyectoId: row.proyecto_id,
    categoria: row.categoria,
    descripcion: row.descripcion,
    monto: Number(row.monto),
    fecha: row.fecha,
    proveedorId: row.proveedor_id,
    facturaId: row.factura_id,
    ordenId: row.orden_id,
    comprobante: row.comprobante,
    creadoEn: row.creado_en,
    creadoPor: row.creado_por,
  };
}

export function mapFacturaCompraRow(
  row: FacturaCompraRow,
  lineas: FacturaCompraLineaRow[] = [],
  retenciones: FacturaCompraRetencionRow[] = [],
): FacturaCompra {
  return {
    id: row.id,
    proveedorId: row.proveedor_id,
    claveAcceso: row.clave_acceso,
    numeroFactura: row.numero_factura,
    fechaEmision: row.fecha_emision,
    subtotalSinIva: Number(row.subtotal_sin_iva),
    iva: Number(row.iva),
    total: Number(row.total),
    xmlUrl: row.xml_url,
    estado: row.estado,
    lineas: [...lineas].sort((a, b) => a.orden - b.orden).map((l): LineaFacturaCompra => ({
      codigoProveedor: l.codigo_proveedor,
      descripcion: l.descripcion,
      cantidad: Number(l.cantidad),
      precioUnitario: Number(l.precio_unitario),
      descuento: Number(l.descuento),
      subtotal: Number(l.subtotal),
      materialId: l.material_id,
      cantidadConvertida: l.cantidad_convertida === null ? null : Number(l.cantidad_convertida),
    })),
    retenciones: retenciones.map((r): Retencion => ({
      tipo: r.tipo,
      porcentaje: Number(r.porcentaje),
      base: Number(r.base),
      valor: Number(r.valor),
    })),
    creadoEn: row.creado_en,
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
