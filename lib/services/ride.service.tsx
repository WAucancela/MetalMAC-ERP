/**
 * ride.service.tsx — genera el RIDE (Representación Impresa del Documento
 * Electrónico) en PDF de una factura ya autorizada por el SRI, vía
 * @react-pdf/renderer (corre en la función serverless de Node, sin browser headless).
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer';
import type { FacturaVenta, LineaFacturaVenta } from '@/types/metalmac.types';
import type { EmisorConfig } from '@/lib/services/sri-emision.service';
import type { SriAmbiente } from '@/lib/services/sri-soap.service';

export interface RideData {
  factura: Pick<
    FacturaVenta,
    'numeroFactura' | 'claveAcceso' | 'clienteNombre' | 'clienteRuc' | 'clienteEmail' | 'fechaEmision' | 'subtotalSinIva' | 'iva' | 'total'
  >;
  lineas: LineaFacturaVenta[];
  emisor: EmisorConfig;
  fechaAutorizacion: string;
  ambiente: SriAmbiente;
}

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 9, fontFamily: 'Helvetica' },
  encabezado: { flexDirection: 'row', justifyContent: 'space-between', borderBottom: 1, paddingBottom: 8, marginBottom: 10 },
  emisorBox: { width: '55%' },
  facturaBox: { width: '40%', border: 1, padding: 6 },
  numeroAutorizacion: { fontSize: 7, wordBreak: 'break-all' },
  razonSocial: { fontSize: 12, fontWeight: 700, marginBottom: 3 },
  linea: { marginBottom: 2 },
  etiqueta: { fontWeight: 700 },
  seccion: { marginBottom: 10 },
  tituloSeccion: { fontWeight: 700, fontSize: 10, marginBottom: 4, backgroundColor: '#eee', padding: 3 },
  tablaHeader: { flexDirection: 'row', backgroundColor: '#333', color: '#fff', padding: 4, fontWeight: 700 },
  tablaFila: { flexDirection: 'row', padding: 4, borderBottom: 1, borderBottomColor: '#ddd' },
  colDescripcion: { width: '50%' },
  colCantidad: { width: '15%', textAlign: 'right' },
  colPrecio: { width: '17%', textAlign: 'right' },
  colSubtotal: { width: '18%', textAlign: 'right' },
  totales: { alignSelf: 'flex-end', width: '40%', marginTop: 10 },
  totalFila: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  totalFinal: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderTop: 1, fontWeight: 700, fontSize: 11 },
  claveAcceso: { marginTop: 16, fontSize: 7, textAlign: 'center', color: '#555' },
  ambienteAviso: { marginTop: 4, fontSize: 8, textAlign: 'center', fontWeight: 700 },
});

function RideDocument({ data }: { data: RideData }) {
  const { factura, lineas, emisor, fechaAutorizacion, ambiente } = data;

  return (
    <Document title={`Factura ${factura.numeroFactura}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.encabezado}>
          <View style={styles.emisorBox}>
            <Text style={styles.razonSocial}>{emisor.razonSocial}</Text>
            <Text style={styles.linea}>{emisor.nombreComercial}</Text>
            <Text style={styles.linea}>RUC: {emisor.ruc}</Text>
            <Text style={styles.linea}>{emisor.dirMatriz}</Text>
            <Text style={styles.linea}>Obligado a llevar contabilidad: {emisor.obligadoContabilidad}</Text>
          </View>
          <View style={styles.facturaBox}>
            <Text style={[styles.linea, styles.etiqueta]}>FACTURA</Text>
            <Text style={styles.linea}>No. {factura.numeroFactura}</Text>
            <Text style={styles.linea}>Fecha emisión: {factura.fechaEmision}</Text>
            <Text style={styles.linea}>Fecha autorización: {fechaAutorizacion}</Text>
            <Text style={styles.linea}>Número de autorización:</Text>
            <Text style={styles.numeroAutorizacion}>{factura.claveAcceso}</Text>
          </View>
        </View>

        <View style={styles.seccion}>
          <Text style={styles.tituloSeccion}>Datos del cliente</Text>
          <Text style={styles.linea}>Razón social / Nombre: {factura.clienteNombre}</Text>
          <Text style={styles.linea}>RUC / Cédula: {factura.clienteRuc}</Text>
          {factura.clienteEmail ? <Text style={styles.linea}>Email: {factura.clienteEmail}</Text> : null}
        </View>

        <View style={styles.seccion}>
          <View style={styles.tablaHeader}>
            <Text style={styles.colDescripcion}>Descripción</Text>
            <Text style={styles.colCantidad}>Cantidad</Text>
            <Text style={styles.colPrecio}>P. Unitario</Text>
            <Text style={styles.colSubtotal}>Subtotal</Text>
          </View>
          {lineas.map((l, i) => (
            <View style={styles.tablaFila} key={i}>
              <Text style={styles.colDescripcion}>{l.descripcion}</Text>
              <Text style={styles.colCantidad}>{l.cantidad}</Text>
              <Text style={styles.colPrecio}>{l.precioUnitario.toFixed(2)}</Text>
              <Text style={styles.colSubtotal}>{l.subtotal.toFixed(2)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totales}>
          <View style={styles.totalFila}>
            <Text>Subtotal sin IVA</Text>
            <Text>${factura.subtotalSinIva.toFixed(2)}</Text>
          </View>
          <View style={styles.totalFila}>
            <Text>IVA (15%)</Text>
            <Text>${factura.iva.toFixed(2)}</Text>
          </View>
          <View style={styles.totalFinal}>
            <Text>TOTAL</Text>
            <Text>${factura.total.toFixed(2)}</Text>
          </View>
        </View>

        <Text style={styles.claveAcceso}>CLAVE DE ACCESO: {factura.claveAcceso}</Text>
        {ambiente === 'PRUEBAS' && (
          <Text style={styles.ambienteAviso}>*** AMBIENTE DE PRUEBAS — SIN VALOR TRIBUTARIO ***</Text>
        )}
      </Page>
    </Document>
  );
}

/** Renderiza el RIDE de la factura a un buffer PDF. */
export async function generarRidePDF(data: RideData): Promise<Buffer> {
  return renderToBuffer(<RideDocument data={data} />);
}
