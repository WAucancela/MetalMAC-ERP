/**
 * scripts/test-emision-sri.ts — corre el flujo completo de emisión electrónica
 * (clave de acceso → XML → firma XAdES-BES → recepción SOAP → autorización SOAP)
 * contra el ambiente de PRUEBAS real del SRI, usando datos de una factura de
 * prueba que este mismo script crea.
 *
 * Hace EXACTAMENTE lo mismo que app/api/contabilidad/facturas-venta/[id]/emitir/route.ts
 * pero sin pasar por HTTP/autenticación — llama a los servicios directo, para poder
 * correrlo desde la terminal sin levantar `next dev` ni loguearse en el navegador.
 * El certificado .p12 sigue teniendo que subirse desde la UI (Configuración →
 * Certificado de firma) porque ese es el único paso que nunca debe pasar por acá
 * (la contraseña se tipea en un <input type=password> del navegador, nunca en una
 * terminal ni en un script).
 *
 * GUARDA DE SEGURIDAD: este script se niega a correr si NEXT_PUBLIC_SUPABASE_URL
 * apunta al proyecto de PRODUCCIÓN real de Taller MAC (uxzdrxebbwisqpygught) — ver
 * el motivo en la memoria del proyecto / en la conversación que lo generó: correr
 * esto ahí quemaría un secuencial real de la serie 001-100.
 *
 * Uso:
 *   ENV_FILE=.env.pruebas-sri.local CONFIRM_PRUEBAS=si npx tsx scripts/test-emision-sri.ts
 *
 * Variables esperadas en ENV_FILE (default .env.pruebas-sri.local, gitignored):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CERT_ENCRYPTION_KEY
 *   (configuracion_sri y certificados_firma ya deben existir en esa base — configuracion_sri
 *   se puede setear con scripts/set-configuracion-sri-pruebas.ts, el certificado se sube
 *   a mano desde la UI).
 */

import * as dotenv from 'dotenv';
const envFile = process.env.ENV_FILE || '.env.pruebas-sri.local';
dotenv.config({ path: envFile });

const PROYECTO_PRODUCCION_REF = 'uxzdrxebbwisqpygught'; // metalmac-erp real — NUNCA correr esto ahí

function assertNoEsProduccion(): void {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  if (url.includes(PROYECTO_PRODUCCION_REF)) {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL (leído de "${envFile}") apunta al proyecto de PRODUCCIÓN de ` +
      `Taller MAC. Este script se niega a correr ahí — usá un proyecto Supabase separado ` +
      `para pruebas. Ver la conversación/memoria sobre por qué (quema un secuencial real).`,
    );
  }
  if (!url) {
    throw new Error(`No se pudo leer NEXT_PUBLIC_SUPABASE_URL de "${envFile}" — ¿existe el archivo?`);
  }
}

async function main() {
  assertNoEsProduccion();

  if (process.env.CONFIRM_PRUEBAS !== 'si') {
    console.log(`\nEste script va a:`);
    console.log(`  1. Crear un cliente/factura de prueba en ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
    console.log(`  2. Firmarla con el certificado .p12 activo en esa base`);
    console.log(`  3. Enviarla al webservice REAL de ambiente de PRUEBAS del SRI (celcer.sri.gob.ec)`);
    console.log(`\nRe-correr con CONFIRM_PRUEBAS=si para proceder.\n`);
    process.exit(1);
  }

  // Imports después de dotenv.config() y de la guarda — lib/supabase/admin.ts lee
  // process.env al importarse, así que el orden acá importa.
  const { supabaseAdmin } = await import('@/lib/supabase/admin');
  const { leerConfiguracionSRI } = await import('@/lib/services/configuracion-sri.service');
  const { cargarCertificadoActivo } = await import('@/lib/services/certificado.service');
  const {
    generarClaveAcceso, generarCodigoNumerico, generarXMLFactura,
  } = await import('@/lib/services/sri-emision.service');
  const { extraerCertificado, firmarXML } = await import('@/lib/services/sri-firma.service');
  const {
    digitoAmbiente, enviarRecepcion, esperarAutorizacion,
  } = await import('@/lib/services/sri-soap.service');
  const { mapFacturaVentaRow } = await import('@/lib/services/mappers');

  console.log('── 1/7 · Leyendo configuración SRI ──────────────────────────');
  const config = await leerConfiguracionSRI();
  if (config.ambiente !== 'PRUEBAS') {
    throw new Error(
      `configuracion_sri.ambiente = "${config.ambiente}" — tiene que ser PRUEBAS para correr ` +
      `este script. Corré scripts/set-configuracion-sri-pruebas.ts o cambialo desde la UI.`,
    );
  }
  console.log(`  Emisor: ${config.emisor.razonSocial} (RUC ${config.emisor.ruc})`);
  console.log(`  Establecimiento/PtoEmisión: ${config.establecimiento}-${config.puntoEmision}`);

  console.log('\n── 2/7 · Cargando certificado de firma activo ───────────────');
  const certificadoActivo = await cargarCertificadoActivo();
  if (!certificadoActivo) {
    throw new Error(
      'No hay certificado activo en certificados_firma. Subilo desde la UI del ERP ' +
      '(Configuración → Certificado de firma) apuntando el dev server a este mismo proyecto.',
    );
  }
  console.log(`  Vigente hasta: ${certificadoActivo.vigenciaHasta?.toISOString().slice(0, 10) ?? 'desconocido'}`);
  if (certificadoActivo.vigenciaHasta && certificadoActivo.vigenciaHasta < new Date()) {
    console.warn('  ⚠️  El certificado activo está VENCIDO — el SRI va a rechazar la firma.');
  }

  console.log('\n── 3/7 · Creando factura de prueba (BORRADOR) ────────────────');
  const cedulaPrueba = generarCedulaPrueba();
  const cantidad = 1;
  const precioUnitario = 10;
  const subtotalSinIva = cantidad * precioUnitario;
  const iva = Math.round(subtotalSinIva * 0.15 * 100) / 100;
  const total = subtotalSinIva + iva;

  const { data: facturaRow, error: insertError } = await supabaseAdmin
    .from('facturas_venta')
    .insert({
      cliente_nombre: 'CLIENTE DE PRUEBA — test-emision-sri.ts',
      cliente_ruc: cedulaPrueba,
      cliente_email: '',
      numero_factura: '',
      fecha_emision: new Date().toISOString().slice(0, 10),
      subtotal_sin_iva: subtotalSinIva,
      iva,
      total,
      estado: 'BORRADOR',
      establecimiento: config.establecimiento,
      punto_emision: config.puntoEmision,
    })
    .select('*')
    .single();
  if (insertError) throw insertError;

  const { error: lineaError } = await supabaseAdmin.from('factura_venta_lineas').insert({
    factura_id: facturaRow.id,
    orden: 0,
    descripcion: 'Producto de prueba — test-emision-sri.ts',
    cantidad,
    precio_unitario: precioUnitario,
    subtotal: subtotalSinIva,
  });
  if (lineaError) throw lineaError;

  const factura = mapFacturaVentaRow(facturaRow, [{
    id: 'tmp', factura_id: facturaRow.id, orden: 0,
    descripcion: 'Producto de prueba — test-emision-sri.ts',
    cantidad, precio_unitario: precioUnitario, subtotal: subtotalSinIva,
    orden_produccion_id: null,
  } as any]);
  console.log(`  Factura creada: ${facturaRow.id} — total USD ${total.toFixed(2)}`);

  console.log('\n── 4/7 · Generando clave de acceso + XML + firma XAdES-BES ──');
  const { data: secuencial, error: secError } = await supabaseAdmin.rpc('siguiente_secuencial_factura_venta', {
    p_establecimiento: factura.establecimiento,
    p_punto_emision: factura.puntoEmision,
  });
  if (secError) throw secError;

  const claveAcceso = generarClaveAcceso({
    fechaEmisionISO: factura.fechaEmision,
    rucEmisor: config.emisor.ruc,
    ambiente: digitoAmbiente('PRUEBAS'),
    establecimiento: factura.establecimiento,
    puntoEmision: factura.puntoEmision,
    secuencial,
    codigoNumerico: generarCodigoNumerico(),
  });
  const numeroFactura = `${factura.establecimiento}-${factura.puntoEmision}-${String(secuencial).padStart(9, '0')}`;
  console.log(`  Secuencial: ${numeroFactura}`);
  console.log(`  Clave de acceso: ${claveAcceso}`);

  const xmlSinFirmar = generarXMLFactura(
    factura, factura.lineas, claveAcceso, factura.establecimiento, factura.puntoEmision, secuencial, config.emisor,
  );
  const certificado = await extraerCertificado(certificadoActivo.p12Base64, certificadoActivo.password);
  const xmlFirmado = await firmarXML(xmlSinFirmar, certificado);
  console.log('  XML generado y firmado OK.');

  await supabaseAdmin
    .from('facturas_venta')
    .update({ clave_acceso: claveAcceso, numero_factura: numeroFactura, secuencial, sri_estado: 'PENDIENTE_ENVIO' })
    .eq('id', facturaRow.id);

  console.log('\n── 5/7 · Enviando recepción al SRI (ambiente PRUEBAS) ────────');
  const xmlFirmadoBase64 = Buffer.from(xmlFirmado, 'utf8').toString('base64');
  const recepcion = await enviarRecepcion(xmlFirmadoBase64, 'PRUEBAS');
  console.log(`  Estado: ${recepcion.estado}`);
  if (recepcion.mensajes.length) recepcion.mensajes.forEach((m) => console.log(`    · ${m}`));

  if (recepcion.estado !== 'RECIBIDA') {
    await supabaseAdmin
      .from('facturas_venta')
      .update({ sri_estado: 'DEVUELTO', sri_mensaje: recepcion.mensajes.join(' | ') })
      .eq('id', facturaRow.id);
    console.log('\n❌ El SRI DEVOLVIÓ el comprobante en recepción — no pasa a autorización.');
    process.exit(1);
  }
  await supabaseAdmin.from('facturas_venta').update({ sri_estado: 'RECIBIDO' }).eq('id', facturaRow.id);

  console.log('\n── 6/7 · Esperando autorización del SRI ──────────────────────');
  const autorizacion = await esperarAutorizacion(claveAcceso, 'PRUEBAS');
  console.log(`  Estado: ${autorizacion.estado}`);
  if (autorizacion.numeroAutorizacion) console.log(`  Número de autorización: ${autorizacion.numeroAutorizacion}`);
  if (autorizacion.mensajes.length) autorizacion.mensajes.forEach((m) => console.log(`    · ${m}`));

  await supabaseAdmin
    .from('facturas_venta')
    .update({
      estado: autorizacion.estado === 'AUTORIZADO' ? 'EMITIDA' : 'BORRADOR',
      sri_estado: autorizacion.estado === 'AUTORIZADO' ? 'AUTORIZADO'
        : autorizacion.estado === 'NO_AUTORIZADO' ? 'RECHAZADO' : 'RECIBIDO',
      sri_mensaje: autorizacion.mensajes.join(' | '),
    })
    .eq('id', facturaRow.id);

  console.log('\n── 7/7 · Resultado ────────────────────────────────────────────');
  if (autorizacion.estado === 'AUTORIZADO') {
    console.log('✅ AUTORIZADO por el SRI (ambiente de pruebas). El flujo completo funciona de punta a punta.');
  } else if (autorizacion.estado === 'EN_PROCESO') {
    console.log('⏳ El SRI todavía no resolvió — la clave de acceso quedó guardada, se puede consultar de nuevo.');
  } else {
    console.log('❌ El SRI NO autorizó el comprobante — revisar los mensajes de arriba.');
    process.exit(1);
  }
  console.log(`\nFactura de prueba: ${facturaRow.id} (queda en la base para inspección manual).`);
}

/**
 * Genera una cédula ecuatoriana con dígito verificador válido (algoritmo módulo 10)
 * pero con una base de dígitos fija/ficticia — nunca la cédula real de una persona —
 * solo para pasar la validación de formato del XML/SRI en un dato de prueba.
 */
function generarCedulaPrueba(): string {
  const base = '170000001'; // provincia 17 (Pichincha), tercer dígito 0 (persona natural), resto arbitrario
  const digitos = base.split('').map(Number);
  const coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  let suma = 0;
  for (let i = 0; i < 9; i++) {
    let valor = digitos[i] * coeficientes[i];
    if (valor > 9) valor -= 9;
    suma += valor;
  }
  const verificador = (10 - (suma % 10)) % 10;
  return base + String(verificador);
}

main().catch((err) => {
  console.error('\n❌ Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
