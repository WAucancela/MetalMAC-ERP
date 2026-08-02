// Los campos de fecha/hora se representan como string ISO 8601 — así es como
// Postgres (timestamptz/date) llega vía PostgREST/supabase-js, a diferencia del
// objeto Timestamp de Firestore que se usaba antes.

// ─────────────────────────────────────────────
// Enums / Literal Union Types
// ─────────────────────────────────────────────

export type TipoUnidadMedida = 'PESO' | 'LONGITUD' | 'AREA' | 'VOLUMEN' | 'UNIDAD';

export type TipoMaterial =
  | 'PLANCHA'
  | 'TUBO'
  | 'PERFIL'
  | 'VARILLA'
  | 'CONSUMIBLE';

export type TipoContribuyente =
  | 'PERSONA_NATURAL'
  | 'SOCIEDAD'
  | 'RISE';

export type TipoMovimiento =
  | 'ENTRADA'
  | 'SALIDA'
  | 'AJUSTE_POSITIVO'
  | 'AJUSTE_NEGATIVO'
  | 'RESERVA'
  | 'LIBERACION'
  | 'MERMA'
  | 'DEVOLUCION';

export type TipoDocumento =
  | 'FACTURA_COMPRA'
  | 'ORDEN_PRODUCCION'
  | 'AJUSTE_MANUAL';

export type EstadoFacturaCompra = 'PENDIENTE' | 'PROCESADA' | 'ANULADA';
export type EstadoFacturaVenta  = 'BORRADOR'  | 'EMITIDA'   | 'ANULADA';

export type TipoRetencion = 'RENTA' | 'IVA';

export type TipoProducto = 'PRODUCTO_TERMINADO' | 'SEMIELABORADO';

export type EstadoOrdenProduccion =
  | 'BORRADOR'
  | 'EN_PROCESO'
  | 'COMPLETADA'
  | 'CANCELADA';

export type TipoOperacion = 'LASER' | 'SOLDADURA' | 'DOBLADO' | 'ENSAMBLE';

export type EstadoOperacionProduccion = 'PENDIENTE' | 'COMPLETADA';

export type EstadoRevisionPedido =
  | 'PENDIENTE'
  | 'EN_REVISION'
  | 'CONVERTIDO'
  | 'RECHAZADO';

export type EstadoProyecto = 'PLANIFICACION' | 'ACTIVO' | 'PAUSADO' | 'COMPLETADO' | 'CANCELADO';

export type CategoriaGasto =
  | 'MATERIALES'
  | 'MANO_DE_OBRA'
  | 'MAQUINARIA'
  | 'TRANSPORTE'
  | 'SUBCONTRATO'
  | 'ADMINISTRATIVO'
  | 'OTRO';

// ─────────────────────────────────────────────
// Catálogo: Unidades de Medida
// ─────────────────────────────────────────────

export interface UnidadMedida {
  id: string;
  nombre: string;   // "Metro Cuadrado"
  simbolo: string;  // "m²"
  tipo: TipoUnidadMedida;
}

// ─────────────────────────────────────────────
// Catálogo: Categorías
// ─────────────────────────────────────────────

export interface Categoria {
  id: string;
  nombre: string;
  parentId: string | null;
  descripcion: string;
}

// ─────────────────────────────────────────────
// Catálogo: Materiales
// ─────────────────────────────────────────────

export interface EspecificacionesPlancha {
  anchoMm: number;
  largoMm: number;
  espesorMm: number;
  pesoKgM2: number;
  acabado?: string;
}

export interface EspecificacionesTuboPerfil {
  longitudNominalMm: number;
  pesoKgM: number;
}

export interface EspecificacionesConsumible {
  rendimientoUnitario: number;
}

export type EspecificacionesMaterial =
  | EspecificacionesPlancha
  | EspecificacionesTuboPerfil
  | EspecificacionesConsumible
  | Record<string, never>;

export interface Material {
  id: string;
  codigoInterno: string;   // único — "ACX-304-3MM-1220X2440"
  nombre: string;
  descripcion: string;
  tipo: TipoMaterial;
  categoriaId: string;
  grado: string;           // "AISI 304", "AISI 316", "A36"
  unidadBaseId: string;
  costoUnitario: number;   // USD por unidad base
  especificaciones: EspecificacionesMaterial;
  activo: boolean;
  creadoEn: string;
  modificadoEn: string;
}

// ─────────────────────────────────────────────
// Catálogo: Proveedores
// ─────────────────────────────────────────────

export interface ContactoProveedor {
  id: string;
  nombre: string;
  cargo: string;
  telefono: string;
  email: string;
  esPrincipal: boolean;
}

export interface Proveedor {
  id: string;
  ruc: string;                // 13 dígitos, único
  razonSocial: string;
  nombreComercial: string;
  tipoContribuyente: TipoContribuyente;
  contribuyenteEspecial: boolean;
  obligaContabilidad: boolean;
  agenteRetencion: boolean;
  diasCredito: number;
  telefonoPrincipal: string;
  emailPrincipal: string;
  ciudad: string;
  activo: boolean;
}

// ─────────────────────────────────────────────
// Catálogo: Tabla de Equivalencias
// ─────────────────────────────────────────────

export interface TablaEquivalencia {
  id: string;
  proveedorId: string;
  codigoProveedor: string;         // código en su factura XML
  descripcionProveedor: string;
  materialId: string;              // → materiales/{id}
  unidadProveedorId: string;
  factorConversion: number;        // 1 unid_proveedor = factor * unidad_base
  precioReferencia: number;        // último precio pagado
  activo: boolean;
}

// ─────────────────────────────────────────────
// Inventario: Stock
// ─────────────────────────────────────────────

export interface Stock {
  materialId: string;              // documentId = materialId (1:1)
  cantidadDisponible: number;
  cantidadReservada: number;
  cantidadMinima: number;
  cantidadMaxima: number | null;
  ubicacion: string;
  actualizadoEn: string;
}

// ─────────────────────────────────────────────
// Inventario: Movimientos
// ─────────────────────────────────────────────

export interface MovimientoInventario {
  id: string;
  materialId: string;
  tipo: TipoMovimiento;
  cantidad: number;
  stockAnterior: number;
  stockPosterior: number;
  costoUnitario: number;
  documentoTipo: TipoDocumento;
  documentoId: string | null;
  numeroReferencia: string;
  notas: string;
  usuarioId: string;
  fecha: string;
}

/** Payload de entrada para registrar un movimiento desde la API */
export interface MovimientoInput {
  materialId: string;
  tipo: TipoMovimiento;
  cantidad: number;
  costoUnitario: number;
  documentoTipo: TipoDocumento;
  documentoId?: string;
  numeroReferencia: string;
  notas?: string;
  usuarioId: string;
}

/** Se lanza cuando un movimiento de salida/reserva excede el stock disponible. */
export class StockInsuficienteError extends Error {
  constructor(
    public readonly materialId: string,
    public readonly disponible: number,
    public readonly solicitado: number,
  ) {
    super(
      `Stock insuficiente para material ${materialId}: disponible=${disponible}, solicitado=${solicitado}`,
    );
    this.name = 'StockInsuficienteError';
  }
}

/** Se lanza cuando no existe el documento /stock/{materialId}. */
export class MaterialNoEncontradoError extends Error {
  constructor(public readonly materialId: string) {
    super(`No existe stock registrado para el material: ${materialId}`);
    this.name = 'MaterialNoEncontradoError';
  }
}

// ─────────────────────────────────────────────
// Contabilidad: Facturas de Compra
// ─────────────────────────────────────────────

export interface LineaFacturaCompra {
  codigoProveedor: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  descuento: number;
  subtotal: number;
  // resuelto desde tabla_equivalencias
  materialId: string | null;
  cantidadConvertida: number | null;
}

export interface Retencion {
  tipo: TipoRetencion;
  porcentaje: number;
  base: number;
  valor: number;
}

export interface FacturaCompra {
  id: string;
  proveedorId: string;
  claveAcceso: string;        // 49 dígitos SRI
  numeroFactura: string;      // 001-001-000000001
  fechaEmision: string;
  subtotalSinIva: number;
  iva: number;                // 15% Ecuador
  total: number;
  xmlUrl: string;             // Firebase Storage URL
  estado: EstadoFacturaCompra;
  lineas: LineaFacturaCompra[];
  retenciones: Retencion[];
  creadoEn: string;
}

// ─────────────────────────────────────────────
// Contabilidad: Facturas de Venta
// ─────────────────────────────────────────────

export interface LineaFacturaVenta {
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  ordenProduccionId: string | null;
}

export type SriEstadoTramite = 'PENDIENTE_ENVIO' | 'RECIBIDO' | 'AUTORIZADO' | 'RECHAZADO' | 'DEVUELTO';

export interface FacturaVenta {
  id: string;
  proyectoId: string | null;
  clienteNombre: string;
  clienteRuc: string;
  clienteEmail: string;
  claveAcceso: string | null;      // se llena al pasar a EMITIDA (a mano en Fase 1, o automático en Fase 2)
  numeroFactura: string;
  establecimiento: string;
  puntoEmision: string;
  secuencial: number | null;       // asignado solo en el momento real de emisión
  fechaEmision: string;
  subtotalSinIva: number;
  iva: number;
  total: number;
  estado: EstadoFacturaVenta;
  lineas: LineaFacturaVenta[];
  creadoEn: string;
  creadoPor: string | null;
  // Fase 2 — trámite electrónico ante el SRI
  xmlFirmadoUrl: string | null;
  rideUrl: string | null;
  sriEstado: SriEstadoTramite | null;
  sriMensaje: string;
  emailEnviadoEn: string | null;
}

// ─────────────────────────────────────────────
// Producción: Productos
// ─────────────────────────────────────────────

export interface Producto {
  id: string;
  codigo: string;
  nombre: string;             // "Poste 8m", "Brazo Luminaria Tipo A"
  descripcion: string;
  tipo: TipoProducto;
  unidadVenta: string;
  precioVenta: number;
  activo: boolean;
}

// ─────────────────────────────────────────────
// Producción: BOM (Bill of Materials)
// ─────────────────────────────────────────────

export interface LineaBOM {
  materialId: string;
  cantidadBase: number;       // cantidad para 1 unidad del producto
  factorMerma: number;        // ej: 1.15 = 15% merma/nesting
  cantidadConMerma: number;   // cantidadBase * factorMerma
  unidadId: string;
  notas: string;
}

export interface OperacionBOM {
  tipo: TipoOperacion;
  minutos: number;            // tiempo para 1 unidad
  costoPorMinuto: number;     // USD/minuto de la máquina/operario
  costoTotal: number;
}

export interface BOM {
  productoId: string;         // documentId = productoId (1:1)
  version: number;
  lineas: LineaBOM[];
  operaciones: OperacionBOM[];
  costoMateriales: number;
  costoOperaciones: number;
  costoTotal: number;
  actualizadoEn: string;
}

// ─────────────────────────────────────────────
// Producción: Órdenes de Producción
// ─────────────────────────────────────────────

export interface MaterialReservado {
  materialId: string;
  cantidadReservada: number;
  costoUnitarioAlMomento: number;
}

export interface Operario {
  id: string;
  nombre: string;
  activo: boolean;
  creadoEn: string;
}

export interface OrdenOperacion {
  id: string;
  ordenId: string;
  orden: number;
  tipo: TipoOperacion;
  minutosPlanificados: number;
  costoPorMinuto: number;
  operarioId: string | null;
  operarioNombre?: string | null;
  estado: EstadoOperacionProduccion;
  minutosReales: number | null;
  completadaEn: string | null;
}

export interface OrdenProduccion {
  id: string;
  codigo: string;             // "OP-2025-0001"
  productoId: string;
  cantidad: number;
  estado: EstadoOrdenProduccion;
  fechaInicio: string;
  fechaEntrega: string;
  costoEstimado: number;
  costoReal: number | null;
  fechaCompletada: string | null;
  proyectoId: string | null;
  notas: string;
  materialesReservados: MaterialReservado[];
  operaciones: OrdenOperacion[];
  creadoEn: string;
}

// ─────────────────────────────────────────────
// Dashboard KPIs
// ─────────────────────────────────────────────

export interface DashboardKPIs {
  cajaReal: number;
  ivaProjectado: number;
  eficienciaMerma: number;
  alertasStockBajo: Material[];
  margenBruto: number;
  ordenesPendientes: number;
  gastosProyectosMes: number;
}

// ─────────────────────────────────────────────
// SRI: Resultado del parseo de XML (fast-xml-parser)
// ─────────────────────────────────────────────

export interface LineaXML {
  codigoInterno: string;        // <codigoPrincipal> en XML
  codigoAdicional: string;      // <codigoAuxiliar> en XML
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  descuento: number;
  precioTotalSinImpuesto: number;
}

export interface ImpuestoXML {
  codigo: string;               // "2" = IVA
  codigoPorcentaje: string;     // "4" = 15%
  tarifa: number;               // 15
  baseImponible: number;
  valor: number;
}

export interface FacturaXMLParseada {
  claveAcceso: string;
  numeroFactura: string;         // "001-001-000000001"
  rucEmisor: string;
  razonSocialEmisor: string;
  fechaEmision: string;          // "DD/MM/YYYY"
  subtotalSinIva: number;
  totalIva: number;
  importeTotal: number;
  lineas: LineaXML[];
  impuestos: ImpuestoXML[];
}

/** Línea ya resuelta contra tabla_equivalencias */
export interface LineaResuelta extends LineaXML {
  materialId: string | null;
  cantidadConvertida: number | null;
  factorConversion: number | null;
  equivalenciaId: string | null;
  resuelta: boolean;
}

// ─────────────────────────────────────────────
// SRI: Clave de Acceso parseada (49 dígitos)
// ─────────────────────────────────────────────

export interface ClaveAccesoSRI {
  fechaEmision: string;        // DDMMAAAA
  tipoComprobante: string;     // "01" = Factura, "04" = Nota Crédito
  rucEmisor: string;           // 13 dígitos
  ambiente: '1' | '2';         // 1 = Pruebas, 2 = Producción
  serie: string;               // establecimiento + punto emisión (6 dígitos)
  secuencial: string;           // 9 dígitos
  codigoNumerico: string;       // 8 dígitos
  tipoEmision: string;          // "1" = Normal
  digitoVerificador: string;
}

// ─────────────────────────────────────────────
// Proyectos y Gastos
// ─────────────────────────────────────────────

export interface Proyecto {
  id: string;
  codigo: string;             // PRY-YYYY-NNNN
  nombre: string;
  descripcion: string;
  cliente: string;
  presupuesto: number;        // USD — presupuesto total aprobado
  costoEstimado: number;      // suma de OPs vinculadas al crear
  costoReal: number;          // suma de gastos registrados
  estado: EstadoProyecto;
  fechaInicio: string;
  fechaFin: string | null;
  responsableId: string;      // usuarioId del responsable
  // ordenesProduccion ya no se persiste: es un índice inverso redundante de
  // ordenes_produccion.proyectoId (FK). Se consulta con SELECT ... WHERE
  // proyecto_id = $1 y se devuelve como campo hermano en la respuesta de la API,
  // no como parte de este tipo.
  creadoEn: string;
  creadoPor: string;
  actualizadoEn: string;
  actualizadoPor: string;
}

export interface GastoProyecto {
  id: string;
  proyectoId: string;
  categoria: CategoriaGasto;
  descripcion: string;
  monto: number;              // USD
  fecha: string;
  proveedorId: string | null;
  facturaId: string | null;   // referencia a facturas_compra
  ordenId: string | null;     // referencia a ordenes_produccion
  comprobante: string | null; // URL en Storage
  creadoEn: string;
  creadoPor: string;
}

// ─────────────────────────────────────────────
// Pedidos WooCommerce (tallermac.com) — bandeja de revisión
// ─────────────────────────────────────────────

export interface LineaPedidoWooCommerce {
  id: string;
  pedidoId: string;
  wcLineItemId: number;
  sku: string;
  nombreProducto: string;
  cantidad: number;
  productoId: string | null;         // resuelto por SKU al ingerir; editable en revisión
  ordenProduccionId: string | null;  // se fija al convertir la línea en OP
}

export interface PedidoWooCommerce {
  id: string;
  wcOrderId: number;
  wcStatus: string;
  numeroPedido: string;
  clienteNombre: string;
  clienteEmail: string;
  total: number;
  moneda: string;
  estadoRevision: EstadoRevisionPedido;
  notas: string;
  lineas: LineaPedidoWooCommerce[];
  recibidoEn: string;
  procesadoEn: string | null;
  procesadoPor: string | null;
}
