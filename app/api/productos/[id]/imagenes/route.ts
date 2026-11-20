/**
 * POST /api/productos/[id]/imagenes — sube una foto a Storage y la agrega a
 * `productos.imagen_urls` del producto (persiste de inmediato, sin depender de
 * que el staff después toque "Guardar cambios" en el resto del formulario).
 */
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getAuthenticatedUser, canWrite } from '@/app/api/_helpers';
import { subirImagenProducto, agregarUrlImagen, ImagenInvalidaError } from '@/lib/services/productos-imagenes.service';

// Nunca cachear: cada respuesta depende del usuario autenticado y de datos que cambian por request.
export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await getAuthenticatedUser(request);
  if (!user)           return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Body inválido — se espera multipart/form-data' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'Campo "file" requerido con la imagen' }, { status: 400 });
  }

  const { data: row, error: fetchError } = await supabaseAdmin
    .from('productos')
    .select('imagen_urls')
    .eq('id', params.id)
    .maybeSingle();
  if (fetchError) return NextResponse.json({ error: 'Error al obtener producto' }, { status: 500 });
  if (!row) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });

  try {
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const { url } = await subirImagenProducto(params.id, fileBuffer, file.type);

    const imagenUrls = agregarUrlImagen(row.imagen_urls, url);
    const { error: updateError } = await supabaseAdmin
      .from('productos')
      .update({ imagen_urls: imagenUrls })
      .eq('id', params.id);
    if (updateError) throw updateError;

    return NextResponse.json({ ok: true, url, imagenUrls });
  } catch (e) {
    if (e instanceof ImagenInvalidaError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error(`[POST /api/productos/${params.id}/imagenes]`, e);
    return NextResponse.json({ error: 'Error al subir la imagen' }, { status: 500 });
  }
}
