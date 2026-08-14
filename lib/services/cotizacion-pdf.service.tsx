/**
 * cotizacion-pdf.service.tsx — genera el PDF de una cotización vía
 * @react-pdf/renderer (mismo enfoque que ride.service.tsx para el RIDE de
 * facturas: corre en la función serverless de Node, sin browser headless).
 * Reusa los datos del emisor de configuracion_sri (razón social, RUC, dirección)
 * como membrete — no hay una config de "empresa" separada todavía.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer';
import type { Cotizacion, LineaCotizacion } from '@/types/metalmac.types';
import type { EmisorConfig } from '@/lib/services/sri-emision.service';

export interface CotizacionPdfData {
  cotizacion: Pick<
    Cotizacion,
    'numero' | 'clienteNombre' | 'clienteEmail' | 'fechaEmision' | 'fechaVencimiento' | 'subtotalSinIva' | 'iva' | 'total' | 'notas'
  >;
  lineas: LineaCotizacion[];
  emisor: EmisorConfig;
}

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 9, fontFamily: 'Helvetica' },
  encabezado: { flexDirection: 'row', justifyContent: 'space-between', borderBottom: 1, paddingBottom: 8, marginBottom: 10 },
  emisorBox: { width: '55%' },
  cotizacionBox: { width: '40%', border: 1, padding: 6 },
  razonSocial: { fontSize: 12, fontWeight: 700, marginBottom: 3 },
  linea: { marginBottom: 2 },
  etiqueta: { fontWeight: 700 },
  seccion: { marginBottom: 10 },
  tituloSeccion: { fontWeight: 700, fontSize: 10, marginBottom: 4, backgroundColor: '#eee', padding: 3 },
  tablaHeader: { flexDirection: 'row', backgroundColor: '#333', color: '#fff', padding: 4, fontWeight: 700 },
  tablaFila: { flexDirection: 'row', padding: 4, borderBottom: 1, borderBottomColor: '#ddd' },
  colDescripcion: { width: '46%' },
  colCantidad: { width: '15%', textAlign: 'right' },
  colPrecio: { width: '18%', textAlign: 'right' },
  colSubtotal: { width: '21%', textAlign: 'right' },
  totales: { alignSelf: 'flex-end', width: '40%', marginTop: 10 },
  totalFila: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  totalFinal: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderTop: 1, fontWeight: 700, fontSize: 11 },
  notas: { marginTop: 16, fontSize: 8, color: '#555' },
  vigencia: { marginTop: 4, fontSize: 8, textAlign: 'center', fontWeight: 700, color: '#b45309' },
});

function CotizacionDocument({ data }: { data: CotizacionPdfData }) {
  const { cotizacion, lineas, emisor } = data;

  return (
    <Document title={`Cotización ${cotizacion.numero}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.encabezado}>
          <View style={styles.emisorBox}>
            <Text style={styles.razonSocial}>{emisor.razonSocial}</Text>
            <Text style={styles.linea}>{emisor.nombreComercial}</Text>
            <Text style={styles.linea}>RUC: {emisor.ruc}</Text>
            <Text style={styles.linea}>{emisor.dirMatriz}</Text>
          </View>
          <View style={styles.cotizacionBox}>
            <Text style={[styles.linea, styles.etiqueta]}>COTIZACIÓN</Text>
            <Text style={styles.linea}>No. {cotizacion.numero}</Text>
            <Text style={styles.linea}>Fecha: {cotizacion.fechaEmision}</Text>
            <Text style={styles.linea}>Válida hasta: {cotizacion.fechaVencimiento}</Text>
          </View>
        </View>

        <View style={styles.seccion}>
          <Text style={styles.tituloSeccion}>Cliente</Text>
          <Text style={styles.linea}>{cotizacion.clienteNombre}</Text>
          {cotizacion.clienteEmail ? <Text style={styles.linea}>Email: {cotizacion.clienteEmail}</Text> : null}
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
            <Text>${cotizacion.subtotalSinIva.toFixed(2)}</Text>
          </View>
          <View style={styles.totalFila}>
            <Text>IVA (15%)</Text>
            <Text>${cotizacion.iva.toFixed(2)}</Text>
          </View>
          <View style={styles.totalFinal}>
            <Text>TOTAL</Text>
            <Text>${cotizacion.total.toFixed(2)}</Text>
          </View>
        </View>

        {cotizacion.notas ? <Text style={styles.notas}>{cotizacion.notas}</Text> : null}
        <Text style={styles.vigencia}>Válida hasta el {cotizacion.fechaVencimiento} — sujeta a disponibilidad de stock.</Text>
      </Page>
    </Document>
  );
}

/** Renderiza la cotización a un buffer PDF. */
export async function generarCotizacionPDF(data: CotizacionPdfData): Promise<Buffer> {
  return renderToBuffer(<CotizacionDocument data={data} />);
}
