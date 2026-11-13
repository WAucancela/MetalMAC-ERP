/**
 * productos-imagenes.service.ts — subida de fotos de producto a Supabase Storage
 * (bucket público `productos-imagenes`) para mostrarlas en el sitio público
 * (tallermac-web).
 *
 * Mismo patrón que certificado.service.ts (supabaseAdmin.storage), pero acá el
 * bucket es público: tallermac-web referencia la imagen directo por su URL.
 */
import { supabaseAdmin } from '@/lib/supabase/admin';

const BUCKET = 'productos-imagenes';

export const MIME_TYPES_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
export const TAMANO_MAXIMO_BYTES = 5 * 1024 * 1024; // 5MB, igual que el límite del bucket

const EXTENSION_POR_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/** El archivo subido no es un tipo de imagen soportado o excede el tamaño permitido. */
export class ImagenInvalidaError extends Error {}

/**
 * Sube una imagen de producto y devuelve su URL pública. El nombre de archivo
 * incluye el id del producto y un timestamp para que nunca choque con otra subida,
 * sin depender de que el nombre original sea único.
 */
export async function subirImagenProducto(
  productoId: string,
  fileBuffer: Buffer,
  contentType: string,
): Promise<{ url: string }> {
  if (!MIME_TYPES_PERMITIDOS.includes(contentType as (typeof MIME_TYPES_PERMITIDOS)[number])) {
    throw new ImagenInvalidaError(`Tipo de imagen no soportado: ${contentType}`);
  }
  if (fileBuffer.byteLength > TAMANO_MAXIMO_BYTES) {
    throw new ImagenInvalidaError('La imagen no debe superar 5 MB');
  }

  const extension = EXTENSION_POR_MIME[contentType];
  const storagePath = `${productoId}/${Date.now()}.${extension}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(storagePath, fileBuffer, { contentType });
  if (uploadError) throw uploadError;

  const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(storagePath);
  return { url: data.publicUrl };
}

/**
 * Agrega una URL al final de `imagenUrls` (una por línea), sin duplicarla si ya
 * estaba. Lógica pura — separada de subirImagenProducto para poder testearla sin
 * mockear Storage.
 */
export function agregarUrlImagen(imagenUrlsActual: string, nuevaUrl: string): string {
  const lineas = imagenUrlsActual.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lineas.includes(nuevaUrl)) return lineas.join('\n');
  return [...lineas, nuevaUrl].join('\n');
}
