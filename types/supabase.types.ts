export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      bom_lineas: {
        Row: {
          bom_producto_id: string
          cantidad_base: number
          cantidad_con_merma: number
          factor_merma: number
          id: string
          material_id: string
          notas: string
          orden: number
          unidad_id: string
        }
        Insert: {
          bom_producto_id: string
          cantidad_base: number
          cantidad_con_merma: number
          factor_merma?: number
          id?: string
          material_id: string
          notas?: string
          orden: number
          unidad_id: string
        }
        Update: {
          bom_producto_id?: string
          cantidad_base?: number
          cantidad_con_merma?: number
          factor_merma?: number
          id?: string
          material_id?: string
          notas?: string
          orden?: number
          unidad_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bom_lineas_bom_producto_id_fkey"
            columns: ["bom_producto_id"]
            isOneToOne: false
            referencedRelation: "boms"
            referencedColumns: ["producto_id"]
          },
          {
            foreignKeyName: "bom_lineas_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materiales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_lineas_unidad_id_fkey"
            columns: ["unidad_id"]
            isOneToOne: false
            referencedRelation: "unidades_medida"
            referencedColumns: ["id"]
          },
        ]
      }
      bom_operaciones: {
        Row: {
          bom_producto_id: string
          costo_por_minuto: number
          costo_total: number
          id: string
          minutos: number
          orden: number
          tipo: Database["public"]["Enums"]["tipo_operacion"]
        }
        Insert: {
          bom_producto_id: string
          costo_por_minuto: number
          costo_total: number
          id?: string
          minutos: number
          orden: number
          tipo: Database["public"]["Enums"]["tipo_operacion"]
        }
        Update: {
          bom_producto_id?: string
          costo_por_minuto?: number
          costo_total?: number
          id?: string
          minutos?: number
          orden?: number
          tipo?: Database["public"]["Enums"]["tipo_operacion"]
        }
        Relationships: [
          {
            foreignKeyName: "bom_operaciones_bom_producto_id_fkey"
            columns: ["bom_producto_id"]
            isOneToOne: false
            referencedRelation: "boms"
            referencedColumns: ["producto_id"]
          },
        ]
      }
      boms: {
        Row: {
          actualizado_en: string
          costo_materiales: number
          costo_operaciones: number
          costo_total: number
          producto_id: string
          version: number
        }
        Insert: {
          actualizado_en?: string
          costo_materiales?: number
          costo_operaciones?: number
          costo_total?: number
          producto_id: string
          version?: number
        }
        Update: {
          actualizado_en?: string
          costo_materiales?: number
          costo_operaciones?: number
          costo_total?: number
          producto_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "boms_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: true
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias: {
        Row: {
          descripcion: string
          id: string
          nombre: string
          parent_id: string | null
        }
        Insert: {
          descripcion?: string
          id?: string
          nombre: string
          parent_id?: string | null
        }
        Update: {
          descripcion?: string
          id?: string
          nombre?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categorias_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      centros_costo: {
        Row: {
          activo: boolean
          codigo: string
          creado_en: string
          id: string
          nombre: string
        }
        Insert: {
          activo?: boolean
          codigo: string
          creado_en?: string
          id?: string
          nombre: string
        }
        Update: {
          activo?: boolean
          codigo?: string
          creado_en?: string
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      certificados_firma: {
        Row: {
          activo: boolean
          id: string
          password_cifrada: string
          storage_path: string
          subido_en: string
          subido_por: string
          vigencia_hasta: string | null
        }
        Insert: {
          activo?: boolean
          id?: string
          password_cifrada: string
          storage_path: string
          subido_en?: string
          subido_por: string
          vigencia_hasta?: string | null
        }
        Update: {
          activo?: boolean
          id?: string
          password_cifrada?: string
          storage_path?: string
          subido_en?: string
          subido_por?: string
          vigencia_hasta?: string | null
        }
        Relationships: []
      }
      configuracion_sri: {
        Row: {
          actualizado_en: string
          actualizado_por: string | null
          ambiente: string | null
          emisor_dir_establecimiento: string | null
          emisor_dir_matriz: string | null
          emisor_nombre_comercial: string | null
          emisor_obligado_contabilidad: string | null
          emisor_razon_social: string | null
          emisor_ruc: string | null
          id: number
          resend_api_key_cifrada: string | null
          resend_from_email: string | null
        }
        Insert: {
          actualizado_en?: string
          actualizado_por?: string | null
          ambiente?: string | null
          emisor_dir_establecimiento?: string | null
          emisor_dir_matriz?: string | null
          emisor_nombre_comercial?: string | null
          emisor_obligado_contabilidad?: string | null
          emisor_razon_social?: string | null
          emisor_ruc?: string | null
          id?: number
          resend_api_key_cifrada?: string | null
          resend_from_email?: string | null
        }
        Update: {
          actualizado_en?: string
          actualizado_por?: string | null
          ambiente?: string | null
          emisor_dir_establecimiento?: string | null
          emisor_dir_matriz?: string | null
          emisor_nombre_comercial?: string | null
          emisor_obligado_contabilidad?: string | null
          emisor_razon_social?: string | null
          emisor_ruc?: string | null
          id?: number
          resend_api_key_cifrada?: string | null
          resend_from_email?: string | null
        }
        Relationships: []
      }
      contadores_anuales: {
        Row: {
          anio: number
          clave: string
          secuencia: number
        }
        Insert: {
          anio: number
          clave: string
          secuencia?: number
        }
        Update: {
          anio?: number
          clave?: string
          secuencia?: number
        }
        Relationships: []
      }
      factura_compra_lineas: {
        Row: {
          cantidad: number
          cantidad_convertida: number | null
          codigo_proveedor: string
          descripcion: string
          descuento: number
          factura_id: string
          id: string
          material_id: string | null
          orden: number
          precio_unitario: number
          subtotal: number
        }
        Insert: {
          cantidad: number
          cantidad_convertida?: number | null
          codigo_proveedor: string
          descripcion: string
          descuento?: number
          factura_id: string
          id?: string
          material_id?: string | null
          orden: number
          precio_unitario: number
          subtotal: number
        }
        Update: {
          cantidad?: number
          cantidad_convertida?: number | null
          codigo_proveedor?: string
          descripcion?: string
          descuento?: number
          factura_id?: string
          id?: string
          material_id?: string | null
          orden?: number
          precio_unitario?: number
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "factura_compra_lineas_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "facturas_compra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factura_compra_lineas_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materiales"
            referencedColumns: ["id"]
          },
        ]
      }
      factura_compra_retenciones: {
        Row: {
          base: number
          factura_id: string
          id: string
          porcentaje: number
          tipo: Database["public"]["Enums"]["tipo_retencion"]
          valor: number
        }
        Insert: {
          base: number
          factura_id: string
          id?: string
          porcentaje: number
          tipo: Database["public"]["Enums"]["tipo_retencion"]
          valor: number
        }
        Update: {
          base?: number
          factura_id?: string
          id?: string
          porcentaje?: number
          tipo?: Database["public"]["Enums"]["tipo_retencion"]
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "factura_compra_retenciones_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "facturas_compra"
            referencedColumns: ["id"]
          },
        ]
      }
      factura_venta_lineas: {
        Row: {
          cantidad: number
          descripcion: string
          factura_id: string
          id: string
          orden: number
          orden_produccion_id: string | null
          precio_unitario: number
          subtotal: number
        }
        Insert: {
          cantidad: number
          descripcion: string
          factura_id: string
          id?: string
          orden: number
          orden_produccion_id?: string | null
          precio_unitario: number
          subtotal: number
        }
        Update: {
          cantidad?: number
          descripcion?: string
          factura_id?: string
          id?: string
          orden?: number
          orden_produccion_id?: string | null
          precio_unitario?: number
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "factura_venta_lineas_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "facturas_venta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factura_venta_lineas_orden_produccion_id_fkey"
            columns: ["orden_produccion_id"]
            isOneToOne: false
            referencedRelation: "ordenes_produccion"
            referencedColumns: ["id"]
          },
        ]
      }
      facturas_compra: {
        Row: {
          clave_acceso: string
          creado_en: string
          estado: Database["public"]["Enums"]["estado_factura_compra"]
          fecha_emision: string
          id: string
          iva: number
          numero_factura: string
          proveedor_id: string
          subtotal_sin_iva: number
          total: number
          xml_url: string
        }
        Insert: {
          clave_acceso: string
          creado_en?: string
          estado?: Database["public"]["Enums"]["estado_factura_compra"]
          fecha_emision: string
          id?: string
          iva: number
          numero_factura: string
          proveedor_id: string
          subtotal_sin_iva: number
          total: number
          xml_url?: string
        }
        Update: {
          clave_acceso?: string
          creado_en?: string
          estado?: Database["public"]["Enums"]["estado_factura_compra"]
          fecha_emision?: string
          id?: string
          iva?: number
          numero_factura?: string
          proveedor_id?: string
          subtotal_sin_iva?: number
          total?: number
          xml_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "facturas_compra_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
        ]
      }
      facturas_venta: {
        Row: {
          clave_acceso: string | null
          cliente_email: string
          cliente_nombre: string
          cliente_ruc: string
          creado_en: string
          creado_por: string | null
          email_enviado_en: string | null
          establecimiento: string
          estado: Database["public"]["Enums"]["estado_factura_venta"]
          fecha_emision: string
          id: string
          iva: number
          numero_factura: string
          proyecto_id: string | null
          punto_emision: string
          ride_url: string | null
          secuencial: number | null
          sri_estado: Database["public"]["Enums"]["sri_estado_tramite"] | null
          sri_mensaje: string
          subtotal_sin_iva: number
          total: number
          xml_firmado_url: string | null
        }
        Insert: {
          clave_acceso?: string | null
          cliente_email?: string
          cliente_nombre: string
          cliente_ruc: string
          creado_en?: string
          creado_por?: string | null
          email_enviado_en?: string | null
          establecimiento?: string
          estado?: Database["public"]["Enums"]["estado_factura_venta"]
          fecha_emision: string
          id?: string
          iva: number
          numero_factura: string
          proyecto_id?: string | null
          punto_emision?: string
          ride_url?: string | null
          secuencial?: number | null
          sri_estado?: Database["public"]["Enums"]["sri_estado_tramite"] | null
          sri_mensaje?: string
          subtotal_sin_iva: number
          total: number
          xml_firmado_url?: string | null
        }
        Update: {
          clave_acceso?: string | null
          cliente_email?: string
          cliente_nombre?: string
          cliente_ruc?: string
          creado_en?: string
          creado_por?: string | null
          email_enviado_en?: string | null
          establecimiento?: string
          estado?: Database["public"]["Enums"]["estado_factura_venta"]
          fecha_emision?: string
          id?: string
          iva?: number
          numero_factura?: string
          proyecto_id?: string | null
          punto_emision?: string
          ride_url?: string | null
          secuencial?: number | null
          sri_estado?: Database["public"]["Enums"]["sri_estado_tramite"] | null
          sri_mensaje?: string
          subtotal_sin_iva?: number
          total?: number
          xml_firmado_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facturas_venta_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
        ]
      }
      gastos: {
        Row: {
          categoria: Database["public"]["Enums"]["categoria_gasto"]
          centro_costo_id: string | null
          comprobante: string | null
          creado_en: string
          creado_por: string
          descripcion: string
          factura_id: string | null
          fecha: string
          id: string
          monto: number
          orden_id: string | null
          proveedor_id: string | null
          proyecto_id: string | null
        }
        Insert: {
          categoria: Database["public"]["Enums"]["categoria_gasto"]
          centro_costo_id?: string | null
          comprobante?: string | null
          creado_en?: string
          creado_por: string
          descripcion: string
          factura_id?: string | null
          fecha: string
          id?: string
          monto: number
          orden_id?: string | null
          proveedor_id?: string | null
          proyecto_id?: string | null
        }
        Update: {
          categoria?: Database["public"]["Enums"]["categoria_gasto"]
          centro_costo_id?: string | null
          comprobante?: string | null
          creado_en?: string
          creado_por?: string
          descripcion?: string
          factura_id?: string | null
          fecha?: string
          id?: string
          monto?: number
          orden_id?: string | null
          proveedor_id?: string | null
          proyecto_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gastos_centro_costo_id_fkey"
            columns: ["centro_costo_id"]
            isOneToOne: false
            referencedRelation: "centros_costo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_proyecto_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "facturas_compra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_proyecto_orden_id_fkey"
            columns: ["orden_id"]
            isOneToOne: false
            referencedRelation: "ordenes_produccion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_proyecto_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_proyecto_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
        ]
      }
      materiales: {
        Row: {
          activo: boolean
          categoria_id: string
          codigo_interno: string
          costo_unitario: number
          creado_en: string
          descripcion: string
          especificaciones: Json
          grado: string
          id: string
          modificado_en: string
          nombre: string
          tipo: Database["public"]["Enums"]["tipo_material"]
          unidad_base_id: string
        }
        Insert: {
          activo?: boolean
          categoria_id: string
          codigo_interno: string
          costo_unitario?: number
          creado_en?: string
          descripcion?: string
          especificaciones?: Json
          grado?: string
          id?: string
          modificado_en?: string
          nombre: string
          tipo: Database["public"]["Enums"]["tipo_material"]
          unidad_base_id: string
        }
        Update: {
          activo?: boolean
          categoria_id?: string
          codigo_interno?: string
          costo_unitario?: number
          creado_en?: string
          descripcion?: string
          especificaciones?: Json
          grado?: string
          id?: string
          modificado_en?: string
          nombre?: string
          tipo?: Database["public"]["Enums"]["tipo_material"]
          unidad_base_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "materiales_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materiales_unidad_base_id_fkey"
            columns: ["unidad_base_id"]
            isOneToOne: false
            referencedRelation: "unidades_medida"
            referencedColumns: ["id"]
          },
        ]
      }
      movimientos_inventario: {
        Row: {
          cantidad: number
          costo_unitario: number
          documento_id: string | null
          documento_tipo: Database["public"]["Enums"]["tipo_documento"]
          fecha: string
          id: string
          material_id: string
          notas: string
          numero_referencia: string
          stock_anterior: number
          stock_posterior: number
          tipo: Database["public"]["Enums"]["tipo_movimiento"]
          usuario_id: string
        }
        Insert: {
          cantidad: number
          costo_unitario?: number
          documento_id?: string | null
          documento_tipo: Database["public"]["Enums"]["tipo_documento"]
          fecha?: string
          id?: string
          material_id: string
          notas?: string
          numero_referencia?: string
          stock_anterior: number
          stock_posterior: number
          tipo: Database["public"]["Enums"]["tipo_movimiento"]
          usuario_id: string
        }
        Update: {
          cantidad?: number
          costo_unitario?: number
          documento_id?: string | null
          documento_tipo?: Database["public"]["Enums"]["tipo_documento"]
          fecha?: string
          id?: string
          material_id?: string
          notas?: string
          numero_referencia?: string
          stock_anterior?: number
          stock_posterior?: number
          tipo?: Database["public"]["Enums"]["tipo_movimiento"]
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_inventario_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materiales"
            referencedColumns: ["id"]
          },
        ]
      }
      operarios: {
        Row: {
          activo: boolean
          creado_en: string
          id: string
          nombre: string
        }
        Insert: {
          activo?: boolean
          creado_en?: string
          id?: string
          nombre: string
        }
        Update: {
          activo?: boolean
          creado_en?: string
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      orden_materiales_reservados: {
        Row: {
          cantidad_reservada: number
          costo_unitario_al_momento: number
          id: string
          material_id: string
          orden_id: string
        }
        Insert: {
          cantidad_reservada: number
          costo_unitario_al_momento: number
          id?: string
          material_id: string
          orden_id: string
        }
        Update: {
          cantidad_reservada?: number
          costo_unitario_al_momento?: number
          id?: string
          material_id?: string
          orden_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orden_materiales_reservados_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materiales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orden_materiales_reservados_orden_id_fkey"
            columns: ["orden_id"]
            isOneToOne: false
            referencedRelation: "ordenes_produccion"
            referencedColumns: ["id"]
          },
        ]
      }
      orden_operaciones: {
        Row: {
          completada_en: string | null
          completada_por: string | null
          costo_por_minuto: number
          estado: Database["public"]["Enums"]["estado_operacion_produccion"]
          id: string
          minutos_planificados: number
          minutos_reales: number | null
          operario_id: string | null
          orden: number
          orden_id: string
          tipo: Database["public"]["Enums"]["tipo_operacion"]
        }
        Insert: {
          completada_en?: string | null
          completada_por?: string | null
          costo_por_minuto: number
          estado?: Database["public"]["Enums"]["estado_operacion_produccion"]
          id?: string
          minutos_planificados: number
          minutos_reales?: number | null
          operario_id?: string | null
          orden: number
          orden_id: string
          tipo: Database["public"]["Enums"]["tipo_operacion"]
        }
        Update: {
          completada_en?: string | null
          completada_por?: string | null
          costo_por_minuto?: number
          estado?: Database["public"]["Enums"]["estado_operacion_produccion"]
          id?: string
          minutos_planificados?: number
          minutos_reales?: number | null
          operario_id?: string | null
          orden?: number
          orden_id?: string
          tipo?: Database["public"]["Enums"]["tipo_operacion"]
        }
        Relationships: [
          {
            foreignKeyName: "orden_operaciones_operario_id_fkey"
            columns: ["operario_id"]
            isOneToOne: false
            referencedRelation: "operarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orden_operaciones_orden_id_fkey"
            columns: ["orden_id"]
            isOneToOne: false
            referencedRelation: "ordenes_produccion"
            referencedColumns: ["id"]
          },
        ]
      }
      ordenes_produccion: {
        Row: {
          actualizado_en: string
          actualizado_por: string | null
          cantidad: number
          codigo: string
          costo_estimado: number
          costo_real: number | null
          creado_en: string
          creado_por: string
          estado: Database["public"]["Enums"]["estado_orden_produccion"]
          fecha_completada: string | null
          fecha_entrega: string
          fecha_inicio: string
          id: string
          notas: string
          producto_id: string
          proyecto_id: string | null
        }
        Insert: {
          actualizado_en?: string
          actualizado_por?: string | null
          cantidad: number
          codigo: string
          costo_estimado?: number
          costo_real?: number | null
          creado_en?: string
          creado_por: string
          estado?: Database["public"]["Enums"]["estado_orden_produccion"]
          fecha_completada?: string | null
          fecha_entrega: string
          fecha_inicio?: string
          id?: string
          notas?: string
          producto_id: string
          proyecto_id?: string | null
        }
        Update: {
          actualizado_en?: string
          actualizado_por?: string | null
          cantidad?: number
          codigo?: string
          costo_estimado?: number
          costo_real?: number | null
          creado_en?: string
          creado_por?: string
          estado?: Database["public"]["Enums"]["estado_orden_produccion"]
          fecha_completada?: string | null
          fecha_entrega?: string
          fecha_inicio?: string
          id?: string
          notas?: string
          producto_id?: string
          proyecto_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ordenes_produccion_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordenes_produccion_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_woocommerce_lineas: {
        Row: {
          cantidad: number
          id: string
          nombre_producto: string
          orden_produccion_id: string | null
          pedido_id: string
          producto_id: string | null
          sku: string
          wc_line_item_id: number
        }
        Insert: {
          cantidad: number
          id?: string
          nombre_producto: string
          orden_produccion_id?: string | null
          pedido_id: string
          producto_id?: string | null
          sku?: string
          wc_line_item_id: number
        }
        Update: {
          cantidad?: number
          id?: string
          nombre_producto?: string
          orden_produccion_id?: string | null
          pedido_id?: string
          producto_id?: string | null
          sku?: string
          wc_line_item_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedido_woocommerce_lineas_orden_produccion_id_fkey"
            columns: ["orden_produccion_id"]
            isOneToOne: false
            referencedRelation: "ordenes_produccion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_woocommerce_lineas_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos_woocommerce"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_woocommerce_lineas_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos_woocommerce: {
        Row: {
          cliente_email: string
          cliente_nombre: string
          estado_revision: Database["public"]["Enums"]["estado_revision_pedido"]
          id: string
          moneda: string
          notas: string
          numero_pedido: string
          payload: Json
          procesado_en: string | null
          procesado_por: string | null
          recibido_en: string
          total: number
          wc_order_id: number
          wc_status: string
        }
        Insert: {
          cliente_email?: string
          cliente_nombre?: string
          estado_revision?: Database["public"]["Enums"]["estado_revision_pedido"]
          id?: string
          moneda?: string
          notas?: string
          numero_pedido: string
          payload: Json
          procesado_en?: string | null
          procesado_por?: string | null
          recibido_en?: string
          total?: number
          wc_order_id: number
          wc_status: string
        }
        Update: {
          cliente_email?: string
          cliente_nombre?: string
          estado_revision?: Database["public"]["Enums"]["estado_revision_pedido"]
          id?: string
          moneda?: string
          notas?: string
          numero_pedido?: string
          payload?: Json
          procesado_en?: string | null
          procesado_por?: string | null
          recibido_en?: string
          total?: number
          wc_order_id?: number
          wc_status?: string
        }
        Relationships: []
      }
      perfiles: {
        Row: {
          creado_en: string
          email: string
          id: string
          rol: Database["public"]["Enums"]["rol_usuario"]
        }
        Insert: {
          creado_en?: string
          email: string
          id: string
          rol: Database["public"]["Enums"]["rol_usuario"]
        }
        Update: {
          creado_en?: string
          email?: string
          id?: string
          rol?: Database["public"]["Enums"]["rol_usuario"]
        }
        Relationships: []
      }
      productos: {
        Row: {
          activo: boolean
          codigo: string
          descripcion: string
          id: string
          nombre: string
          precio_venta: number
          tipo: Database["public"]["Enums"]["tipo_producto"]
          unidad_venta: string
        }
        Insert: {
          activo?: boolean
          codigo: string
          descripcion?: string
          id?: string
          nombre: string
          precio_venta?: number
          tipo: Database["public"]["Enums"]["tipo_producto"]
          unidad_venta?: string
        }
        Update: {
          activo?: boolean
          codigo?: string
          descripcion?: string
          id?: string
          nombre?: string
          precio_venta?: number
          tipo?: Database["public"]["Enums"]["tipo_producto"]
          unidad_venta?: string
        }
        Relationships: []
      }
      proveedores: {
        Row: {
          activo: boolean
          agente_retencion: boolean
          ciudad: string
          contribuyente_especial: boolean
          dias_credito: number
          email_principal: string
          id: string
          nombre_comercial: string
          obliga_contabilidad: boolean
          razon_social: string
          ruc: string
          telefono_principal: string
          tipo_contribuyente: Database["public"]["Enums"]["tipo_contribuyente"]
        }
        Insert: {
          activo?: boolean
          agente_retencion?: boolean
          ciudad?: string
          contribuyente_especial?: boolean
          dias_credito?: number
          email_principal?: string
          id?: string
          nombre_comercial?: string
          obliga_contabilidad?: boolean
          razon_social: string
          ruc: string
          telefono_principal?: string
          tipo_contribuyente: Database["public"]["Enums"]["tipo_contribuyente"]
        }
        Update: {
          activo?: boolean
          agente_retencion?: boolean
          ciudad?: string
          contribuyente_especial?: boolean
          dias_credito?: number
          email_principal?: string
          id?: string
          nombre_comercial?: string
          obliga_contabilidad?: boolean
          razon_social?: string
          ruc?: string
          telefono_principal?: string
          tipo_contribuyente?: Database["public"]["Enums"]["tipo_contribuyente"]
        }
        Relationships: []
      }
      proveedores_contactos: {
        Row: {
          cargo: string
          email: string
          es_principal: boolean
          id: string
          nombre: string
          proveedor_id: string
          telefono: string
        }
        Insert: {
          cargo?: string
          email?: string
          es_principal?: boolean
          id?: string
          nombre: string
          proveedor_id: string
          telefono?: string
        }
        Update: {
          cargo?: string
          email?: string
          es_principal?: boolean
          id?: string
          nombre?: string
          proveedor_id?: string
          telefono?: string
        }
        Relationships: [
          {
            foreignKeyName: "proveedores_contactos_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
        ]
      }
      proyectos: {
        Row: {
          actualizado_en: string
          actualizado_por: string | null
          cliente: string
          codigo: string
          costo_estimado: number
          costo_real: number
          creado_en: string
          creado_por: string
          descripcion: string
          estado: Database["public"]["Enums"]["estado_proyecto"]
          fecha_fin: string | null
          fecha_inicio: string
          id: string
          nombre: string
          presupuesto: number
          responsable_id: string
        }
        Insert: {
          actualizado_en?: string
          actualizado_por?: string | null
          cliente: string
          codigo: string
          costo_estimado?: number
          costo_real?: number
          creado_en?: string
          creado_por: string
          descripcion?: string
          estado?: Database["public"]["Enums"]["estado_proyecto"]
          fecha_fin?: string | null
          fecha_inicio: string
          id?: string
          nombre: string
          presupuesto: number
          responsable_id: string
        }
        Update: {
          actualizado_en?: string
          actualizado_por?: string | null
          cliente?: string
          codigo?: string
          costo_estimado?: number
          costo_real?: number
          creado_en?: string
          creado_por?: string
          descripcion?: string
          estado?: Database["public"]["Enums"]["estado_proyecto"]
          fecha_fin?: string | null
          fecha_inicio?: string
          id?: string
          nombre?: string
          presupuesto?: number
          responsable_id?: string
        }
        Relationships: []
      }
      stock: {
        Row: {
          actualizado_en: string
          cantidad_disponible: number
          cantidad_maxima: number | null
          cantidad_minima: number
          cantidad_reservada: number
          material_id: string
          ubicacion: string
        }
        Insert: {
          actualizado_en?: string
          cantidad_disponible?: number
          cantidad_maxima?: number | null
          cantidad_minima?: number
          cantidad_reservada?: number
          material_id: string
          ubicacion?: string
        }
        Update: {
          actualizado_en?: string
          cantidad_disponible?: number
          cantidad_maxima?: number | null
          cantidad_minima?: number
          cantidad_reservada?: number
          material_id?: string
          ubicacion?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: true
            referencedRelation: "materiales"
            referencedColumns: ["id"]
          },
        ]
      }
      tabla_equivalencias: {
        Row: {
          activo: boolean
          codigo_proveedor: string
          descripcion_proveedor: string
          factor_conversion: number
          id: string
          material_id: string
          precio_referencia: number
          proveedor_id: string
          unidad_proveedor_id: string
        }
        Insert: {
          activo?: boolean
          codigo_proveedor: string
          descripcion_proveedor?: string
          factor_conversion: number
          id?: string
          material_id: string
          precio_referencia?: number
          proveedor_id: string
          unidad_proveedor_id: string
        }
        Update: {
          activo?: boolean
          codigo_proveedor?: string
          descripcion_proveedor?: string
          factor_conversion?: number
          id?: string
          material_id?: string
          precio_referencia?: number
          proveedor_id?: string
          unidad_proveedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tabla_equivalencias_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materiales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tabla_equivalencias_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tabla_equivalencias_unidad_proveedor_id_fkey"
            columns: ["unidad_proveedor_id"]
            isOneToOne: false
            referencedRelation: "unidades_medida"
            referencedColumns: ["id"]
          },
        ]
      }
      unidades_medida: {
        Row: {
          id: string
          nombre: string
          simbolo: string
          tipo: Database["public"]["Enums"]["tipo_unidad_medida"]
        }
        Insert: {
          id?: string
          nombre: string
          simbolo: string
          tipo: Database["public"]["Enums"]["tipo_unidad_medida"]
        }
        Update: {
          id?: string
          nombre?: string
          simbolo?: string
          tipo?: Database["public"]["Enums"]["tipo_unidad_medida"]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      consumir_materiales_bom: {
        Args: { p_orden_id: string; p_usuario_id: string }
        Returns: undefined
      }
      convertir_linea_pedido_woocommerce: {
        Args: {
          p_cantidad: number
          p_fecha_entrega: string
          p_linea_id: string
          p_notas: string
          p_pedido_id: string
          p_producto_id: string
          p_proyecto_id: string
          p_usuario_id: string
        }
        Returns: {
          actualizado_en: string
          actualizado_por: string | null
          cantidad: number
          codigo: string
          costo_estimado: number
          costo_real: number | null
          creado_en: string
          creado_por: string
          estado: Database["public"]["Enums"]["estado_orden_produccion"]
          fecha_completada: string | null
          fecha_entrega: string
          fecha_inicio: string
          id: string
          notas: string
          producto_id: string
          proyecto_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "ordenes_produccion"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      crear_orden_produccion: {
        Args: {
          p_cantidad: number
          p_fecha_entrega: string
          p_notas: string
          p_producto_id: string
          p_proyecto_id: string
          p_usuario_id: string
        }
        Returns: {
          actualizado_en: string
          actualizado_por: string | null
          cantidad: number
          codigo: string
          costo_estimado: number
          costo_real: number | null
          creado_en: string
          creado_por: string
          estado: Database["public"]["Enums"]["estado_orden_produccion"]
          fecha_completada: string | null
          fecha_entrega: string
          fecha_inicio: string
          id: string
          notas: string
          producto_id: string
          proyecto_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "ordenes_produccion"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      crear_proyecto: {
        Args: {
          p_cliente: string
          p_costo_estimado: number
          p_descripcion: string
          p_fecha_inicio: string
          p_nombre: string
          p_presupuesto: number
          p_responsable_id: string
          p_usuario_id: string
        }
        Returns: {
          actualizado_en: string
          actualizado_por: string | null
          cliente: string
          codigo: string
          costo_estimado: number
          costo_real: number
          creado_en: string
          creado_por: string
          descripcion: string
          estado: Database["public"]["Enums"]["estado_proyecto"]
          fecha_fin: string | null
          fecha_inicio: string
          id: string
          nombre: string
          presupuesto: number
          responsable_id: string
        }
        SetofOptions: {
          from: "*"
          to: "proyectos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      liberar_materiales_bom: {
        Args: { p_orden_id: string; p_usuario_id: string }
        Returns: undefined
      }
      reemplazar_lineas_pendientes_pedido_woocommerce: {
        Args: { p_lineas: Json; p_pedido_id: string }
        Returns: undefined
      }
      registrar_movimiento_inventario: {
        Args: {
          p_cantidad: number
          p_costo_unitario: number
          p_documento_id: string
          p_documento_tipo: Database["public"]["Enums"]["tipo_documento"]
          p_material_id: string
          p_notas: string
          p_numero_referencia: string
          p_tipo: Database["public"]["Enums"]["tipo_movimiento"]
          p_usuario_id: string
        }
        Returns: string
      }
      reservar_materiales_bom: {
        Args: {
          p_orden_id: string
          p_producto_id: string
          p_unidades: number
          p_usuario_id: string
        }
        Returns: Json
      }
      siguiente_secuencia_anual: {
        Args: { p_anio: number; p_prefijo: string }
        Returns: number
      }
      siguiente_secuencial_factura_venta: {
        Args: { p_establecimiento: string; p_punto_emision: string }
        Returns: number
      }
    }
    Enums: {
      categoria_gasto:
        | "MATERIALES"
        | "MANO_DE_OBRA"
        | "MAQUINARIA"
        | "TRANSPORTE"
        | "SUBCONTRATO"
        | "ADMINISTRATIVO"
        | "OTRO"
      estado_factura_compra: "PENDIENTE" | "PROCESADA" | "ANULADA"
      estado_factura_venta: "BORRADOR" | "EMITIDA" | "ANULADA"
      estado_operacion_produccion: "PENDIENTE" | "COMPLETADA"
      estado_orden_produccion:
        | "BORRADOR"
        | "EN_PROCESO"
        | "COMPLETADA"
        | "CANCELADA"
      estado_proyecto:
        | "PLANIFICACION"
        | "ACTIVO"
        | "PAUSADO"
        | "COMPLETADO"
        | "CANCELADO"
      estado_revision_pedido:
        | "PENDIENTE"
        | "EN_REVISION"
        | "CONVERTIDO"
        | "RECHAZADO"
      rol_usuario: "GERENTE" | "BODEGUERO" | "PRODUCCION" | "CONTABILIDAD"
      sri_estado_tramite:
        | "PENDIENTE_ENVIO"
        | "RECIBIDO"
        | "AUTORIZADO"
        | "RECHAZADO"
        | "DEVUELTO"
      tipo_contribuyente: "PERSONA_NATURAL" | "SOCIEDAD" | "RISE"
      tipo_documento: "FACTURA_COMPRA" | "ORDEN_PRODUCCION" | "AJUSTE_MANUAL"
      tipo_material: "PLANCHA" | "TUBO" | "PERFIL" | "VARILLA" | "CONSUMIBLE"
      tipo_movimiento:
        | "ENTRADA"
        | "SALIDA"
        | "AJUSTE_POSITIVO"
        | "AJUSTE_NEGATIVO"
        | "RESERVA"
        | "LIBERACION"
        | "MERMA"
        | "DEVOLUCION"
      tipo_operacion: "LASER" | "SOLDADURA" | "DOBLADO" | "ENSAMBLE"
      tipo_producto: "PRODUCTO_TERMINADO" | "SEMIELABORADO"
      tipo_retencion: "RENTA" | "IVA"
      tipo_unidad_medida: "PESO" | "LONGITUD" | "AREA" | "VOLUMEN" | "UNIDAD"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      categoria_gasto: [
        "MATERIALES",
        "MANO_DE_OBRA",
        "MAQUINARIA",
        "TRANSPORTE",
        "SUBCONTRATO",
        "ADMINISTRATIVO",
        "OTRO",
      ],
      estado_factura_compra: ["PENDIENTE", "PROCESADA", "ANULADA"],
      estado_factura_venta: ["BORRADOR", "EMITIDA", "ANULADA"],
      estado_operacion_produccion: ["PENDIENTE", "COMPLETADA"],
      estado_orden_produccion: [
        "BORRADOR",
        "EN_PROCESO",
        "COMPLETADA",
        "CANCELADA",
      ],
      estado_proyecto: [
        "PLANIFICACION",
        "ACTIVO",
        "PAUSADO",
        "COMPLETADO",
        "CANCELADO",
      ],
      estado_revision_pedido: [
        "PENDIENTE",
        "EN_REVISION",
        "CONVERTIDO",
        "RECHAZADO",
      ],
      rol_usuario: ["GERENTE", "BODEGUERO", "PRODUCCION", "CONTABILIDAD"],
      sri_estado_tramite: [
        "PENDIENTE_ENVIO",
        "RECIBIDO",
        "AUTORIZADO",
        "RECHAZADO",
        "DEVUELTO",
      ],
      tipo_contribuyente: ["PERSONA_NATURAL", "SOCIEDAD", "RISE"],
      tipo_documento: ["FACTURA_COMPRA", "ORDEN_PRODUCCION", "AJUSTE_MANUAL"],
      tipo_material: ["PLANCHA", "TUBO", "PERFIL", "VARILLA", "CONSUMIBLE"],
      tipo_movimiento: [
        "ENTRADA",
        "SALIDA",
        "AJUSTE_POSITIVO",
        "AJUSTE_NEGATIVO",
        "RESERVA",
        "LIBERACION",
        "MERMA",
        "DEVOLUCION",
      ],
      tipo_operacion: ["LASER", "SOLDADURA", "DOBLADO", "ENSAMBLE"],
      tipo_producto: ["PRODUCTO_TERMINADO", "SEMIELABORADO"],
      tipo_retencion: ["RENTA", "IVA"],
      tipo_unidad_medida: ["PESO", "LONGITUD", "AREA", "VOLUMEN", "UNIDAD"],
    },
  },
} as const
