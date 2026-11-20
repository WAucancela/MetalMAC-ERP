/**
 * scripts/set-configuracion-sri-pruebas.ts — hace upsert de configuracion_sri con
 * ambiente=PRUEBAS + los datos del emisor, leídos de variables de entorno (todos
 * datos públicos de registro ante el SRI, no secretos — a diferencia del .p12 o la
 * API key de Resend, que nunca pasan por acá).
 *
 * Uso:
 *   ENV_FILE=.env.pruebas-sri.local npx tsx scripts/set-configuracion-sri-pruebas.ts
 *
 * Variables esperadas en ENV_FILE (además de NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY):
 *   EMISOR_RUC, EMISOR_RAZON_SOCIAL, EMISOR_NOMBRE_COMERCIAL, EMISOR_DIR_MATRIZ,
 *   EMISOR_DIR_ESTABLECIMIENTO, EMISOR_OBLIGADO_CONTABILIDAD (SI|NO),
 *   SRI_ESTABLECIMIENTO (ej. "001"), SRI_PUNTO_EMISION (ej. "001")
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: process.env.ENV_FILE || '.env.pruebas-sri.local' });

const PROYECTO_PRODUCCION_REF = 'uxzdrxebbwisqpygught';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  if (url.includes(PROYECTO_PRODUCCION_REF)) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL apunta al proyecto de PRODUCCIÓN — este script se niega a correr ahí.');
  }

  const requerido = (nombre: string): string => {
    const valor = process.env[nombre];
    if (!valor) throw new Error(`Falta la variable de entorno ${nombre} en ${process.env.ENV_FILE || '.env.pruebas-sri.local'}`);
    return valor;
  };

  const { supabaseAdmin } = await import('@/lib/supabase/admin');

  const fila = {
    id: 1 as const,
    ambiente: 'PRUEBAS' as const,
    emisor_ruc: requerido('EMISOR_RUC'),
    emisor_razon_social: requerido('EMISOR_RAZON_SOCIAL'),
    emisor_nombre_comercial: requerido('EMISOR_NOMBRE_COMERCIAL'),
    emisor_dir_matriz: requerido('EMISOR_DIR_MATRIZ'),
    emisor_dir_establecimiento: requerido('EMISOR_DIR_ESTABLECIMIENTO'),
    emisor_obligado_contabilidad: requerido('EMISOR_OBLIGADO_CONTABILIDAD') as 'SI' | 'NO',
    establecimiento: process.env.SRI_ESTABLECIMIENTO || '001',
    punto_emision: process.env.SRI_PUNTO_EMISION || '001',
    resend_from_email: process.env.RESEND_FROM_EMAIL || 'pruebas@example.com',
    actualizado_en: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin.from('configuracion_sri').upsert(fila);
  if (error) throw error;

  console.log('✅ configuracion_sri actualizada (ambiente=PRUEBAS):');
  console.log(`   Emisor: ${fila.emisor_razon_social} (RUC ${fila.emisor_ruc})`);
  console.log(`   Establecimiento/PtoEmisión: ${fila.establecimiento}-${fila.punto_emision}`);
}

main().catch((err) => {
  console.error('❌ Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
