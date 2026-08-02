/**
 * certificado.service.ts — gestión del certificado .p12 de firma electrónica
 * subido desde el ERP (reemplaza a las env vars SRI_FIRMA_P12_BASE64/PASSWORD).
 *
 * La contraseña del .p12 nunca se guarda en texto plano: se cifra vía
 * lib/services/cifrado.service.ts con CERT_ENCRYPTION_KEY.
 */

import { supabaseAdmin } from '@/lib/supabase/admin';
import { extraerCertificado } from '@/lib/services/sri-firma.service';
import { encriptar, desencriptar, leerClaveCifrado } from '@/lib/services/cifrado.service';

const BUCKET = 'certificados-firma';

// ─────────────────────────────────────────────
// Subida / lectura del certificado activo (I/O)
// ─────────────────────────────────────────────

export interface CertificadoActivo {
  p12Base64: string;
  password: string;
  vigenciaHasta: Date | null;
}

/** El archivo/contraseña subidos no son un .p12 válido — error de entrada del usuario, no del servidor. */
export class CertificadoInvalidoError extends Error {}

/**
 * Valida, sube y activa un nuevo certificado. Valida el .p12 ANTES de tocar
 * Storage/la base de datos (mismo criterio que el resto del pipeline SRI: nunca
 * persistir a mitad de camino con datos que ya sabemos inválidos).
 */
export async function subirCertificado(
  fileBuffer: Buffer,
  passwordPlano: string,
  usuarioId: string,
): Promise<{ vigenciaHasta: Date }> {
  const p12Base64 = fileBuffer.toString('base64');
  let vigenciaHasta: Date;
  try {
    ({ vigenciaHasta } = await extraerCertificado(p12Base64, passwordPlano));
  } catch (e) {
    throw new CertificadoInvalidoError((e as Error).message);
  }

  const storagePath = `cert-${Date.now()}.p12`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(storagePath, fileBuffer, { contentType: 'application/x-pkcs12' });
  if (uploadError) throw uploadError;

  const passwordCifrada = encriptar(passwordPlano, leerClaveCifrado());

  const { error: desactivarError } = await supabaseAdmin
    .from('certificados_firma')
    .update({ activo: false })
    .eq('activo', true);
  if (desactivarError) throw desactivarError;

  const { error: insertError } = await supabaseAdmin.from('certificados_firma').insert({
    storage_path: storagePath,
    password_cifrada: passwordCifrada,
    vigencia_hasta: vigenciaHasta.toISOString().slice(0, 10),
    activo: true,
    subido_por: usuarioId,
  });
  if (insertError) throw insertError;

  return { vigenciaHasta };
}

/** Devuelve el certificado activo listo para firmar, o `null` si no hay ninguno. */
export async function cargarCertificadoActivo(): Promise<CertificadoActivo | null> {
  const { data: fila, error } = await supabaseAdmin
    .from('certificados_firma')
    .select('storage_path, password_cifrada, vigencia_hasta')
    .eq('activo', true)
    .maybeSingle();
  if (error) throw error;
  if (!fila) return null;

  const { data: archivo, error: downloadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .download(fila.storage_path);
  if (downloadError) throw downloadError;

  const p12Base64 = Buffer.from(await archivo.arrayBuffer()).toString('base64');
  const password = desencriptar(fila.password_cifrada, leerClaveCifrado());

  return {
    p12Base64,
    password,
    vigenciaHasta: fila.vigencia_hasta ? new Date(fila.vigencia_hasta) : null,
  };
}

/** Estado del certificado activo, para mostrar en la UI (nunca expone la contraseña). */
export async function obtenerEstadoCertificado(): Promise<{ vigenciaHasta: Date | null; subidoEn: string | null }> {
  const { data: fila, error } = await supabaseAdmin
    .from('certificados_firma')
    .select('vigencia_hasta, subido_en')
    .eq('activo', true)
    .maybeSingle();
  if (error) throw error;
  if (!fila) return { vigenciaHasta: null, subidoEn: null };

  return {
    vigenciaHasta: fila.vigencia_hasta ? new Date(fila.vigencia_hasta) : null,
    subidoEn: fila.subido_en,
  };
}
