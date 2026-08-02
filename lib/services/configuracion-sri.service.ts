/**
 * configuracion-sri.service.ts — configuración SRI/Resend editable desde el ERP
 * (reemplaza a las env vars SRI_AMBIENTE, SRI_EMISOR_..., RESEND_API_KEY y
 * RESEND_FROM_EMAIL). Tabla singleton `configuracion_sri` (una sola fila, id=1).
 */

import { supabaseAdmin } from '@/lib/supabase/admin';
import { encriptar, desencriptar, leerClaveCifrado } from '@/lib/services/cifrado.service';
import type { EmisorConfig } from '@/lib/services/sri-emision.service';
import type { SriAmbiente } from '@/lib/services/sri-soap.service';
import type { Database } from '@/types/supabase.types';

type ConfiguracionSRIInsert = Database['public']['Tables']['configuracion_sri']['Insert'];

export interface ConfiguracionSRIInput {
  ambiente: SriAmbiente;
  emisorRuc: string;
  emisorRazonSocial: string;
  emisorNombreComercial: string;
  emisorDirMatriz: string;
  emisorDirEstablecimiento: string;
  emisorObligadoContabilidad: 'SI' | 'NO';
  resendFromEmail: string;
  /** Vacío/omitido = no cambiar la que ya había guardada. */
  resendApiKey?: string;
}

export interface ConfiguracionSRICompleta {
  ambiente: SriAmbiente;
  emisor: EmisorConfig;
  resendApiKey: string | null;
  resendFromEmail: string;
}

export interface EstadoConfiguracionSRI {
  ambiente: SriAmbiente | null;
  emisorRuc: string | null;
  emisorRazonSocial: string | null;
  emisorNombreComercial: string | null;
  emisorDirMatriz: string | null;
  emisorDirEstablecimiento: string | null;
  emisorObligadoContabilidad: 'SI' | 'NO' | null;
  resendFromEmail: string | null;
  resendApiKeyConfigurada: boolean;
}

/**
 * Lee la configuración completa y valida que esté todo lo necesario para poder
 * emitir (ambiente + los 6 datos del emisor + email remitente). Tira un error
 * claro con el campo que falta — nunca sigue adelante con una config a medias.
 * La API key de Resend puede faltar (el envío de email ya es "mejor esfuerzo",
 * no bloquea la emisión).
 */
export async function leerConfiguracionSRI(): Promise<ConfiguracionSRICompleta> {
  const { data: fila, error } = await supabaseAdmin
    .from('configuracion_sri')
    .select('*')
    .eq('id', 1)
    .maybeSingle();
  if (error) throw error;

  const faltante = (valor: unknown, nombre: string) => {
    if (!valor) throw new Error(`Falta configurar ${nombre} — configuralo en Configuración → SRI / Resend`);
  };

  faltante(fila?.ambiente, 'el ambiente del SRI');
  faltante(fila?.emisor_ruc, 'el RUC del emisor');
  faltante(fila?.emisor_razon_social, 'la razón social del emisor');
  faltante(fila?.emisor_nombre_comercial, 'el nombre comercial del emisor');
  faltante(fila?.emisor_dir_matriz, 'la dirección de la matriz');
  faltante(fila?.emisor_dir_establecimiento, 'la dirección del establecimiento');
  faltante(fila?.emisor_obligado_contabilidad, 'si el emisor está obligado a llevar contabilidad');
  faltante(fila?.resend_from_email, 'el email remitente de Resend');

  return {
    ambiente: fila!.ambiente as SriAmbiente,
    emisor: {
      ruc: fila!.emisor_ruc!,
      razonSocial: fila!.emisor_razon_social!,
      nombreComercial: fila!.emisor_nombre_comercial!,
      dirMatriz: fila!.emisor_dir_matriz!,
      dirEstablecimiento: fila!.emisor_dir_establecimiento!,
      obligadoContabilidad: fila!.emisor_obligado_contabilidad as 'SI' | 'NO',
    },
    resendApiKey: fila!.resend_api_key_cifrada
      ? desencriptar(fila!.resend_api_key_cifrada, leerClaveCifrado())
      : null,
    resendFromEmail: fila!.resend_from_email!,
  };
}

/** Estado para la UI — nunca expone la API key (ni cifrada ni en texto plano). */
export async function obtenerEstadoConfiguracionSRI(): Promise<EstadoConfiguracionSRI> {
  const { data: fila, error } = await supabaseAdmin
    .from('configuracion_sri')
    .select('*')
    .eq('id', 1)
    .maybeSingle();
  if (error) throw error;

  return {
    ambiente: (fila?.ambiente as SriAmbiente | null) ?? null,
    emisorRuc: fila?.emisor_ruc ?? null,
    emisorRazonSocial: fila?.emisor_razon_social ?? null,
    emisorNombreComercial: fila?.emisor_nombre_comercial ?? null,
    emisorDirMatriz: fila?.emisor_dir_matriz ?? null,
    emisorDirEstablecimiento: fila?.emisor_dir_establecimiento ?? null,
    emisorObligadoContabilidad: (fila?.emisor_obligado_contabilidad as 'SI' | 'NO' | null) ?? null,
    resendFromEmail: fila?.resend_from_email ?? null,
    resendApiKeyConfigurada: !!fila?.resend_api_key_cifrada,
  };
}

/**
 * Guarda (upsert) la configuración. Si `resendApiKey` viene vacío/undefined, NO
 * toca la que ya había guardada — patrón estándar de "dejar en blanco para no
 * cambiar el secreto".
 */
export async function guardarConfiguracionSRI(input: ConfiguracionSRIInput, usuarioId: string): Promise<void> {
  const fila: ConfiguracionSRIInsert = {
    id: 1,
    ambiente: input.ambiente,
    emisor_ruc: input.emisorRuc,
    emisor_razon_social: input.emisorRazonSocial,
    emisor_nombre_comercial: input.emisorNombreComercial,
    emisor_dir_matriz: input.emisorDirMatriz,
    emisor_dir_establecimiento: input.emisorDirEstablecimiento,
    emisor_obligado_contabilidad: input.emisorObligadoContabilidad,
    resend_from_email: input.resendFromEmail,
    actualizado_en: new Date().toISOString(),
    actualizado_por: usuarioId,
    ...(input.resendApiKey ? { resend_api_key_cifrada: encriptar(input.resendApiKey, leerClaveCifrado()) } : {}),
  };

  const { error } = await supabaseAdmin.from('configuracion_sri').upsert(fila);
  if (error) throw error;
}
