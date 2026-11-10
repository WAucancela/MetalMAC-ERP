/**
 * POST /api/productos/[id]/publicar-tienda — publica (o actualiza) el producto en
 * tallermac.com vía la REST API de WooCommerce.
 *
 * Primera llamada (wc_product_id null) → crea el producto en WooCommerce y guarda
 * el id devuelto. Llamadas siguientes → actualiza ese mismo producto en vez de
 * crear uno duplicado. El enlace entre ambos sistemas es wc_product_id, no el SKU
 * (el SKU puede coincidir por casualidad con un producto ya existente en la tienda
 * que no tiene nada que ver con este).
 */
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getAuthenticatedUser, canWrite } from '@/app/api/_helpers';
import { mapProductoRow } from '@/lib/services/mappers';
import { construirPayloadProductoWC, puedePublicarseEnTienda } from '@/lib/services/woocommerce.service';
import { crearProductoWC, actualizarProductoWC } from '@/lib/services/woocommerce-api.service';

// Nunca cachear: cada respuesta depende del usuario autenticado y de datos que cambian por request.
export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await getAuthenticatedUser(request);
  if (!user)           return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  const { data: row, error: fetchError } = await supabaseAdmin
    .from('productos')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();
  if (fetchError) return NextResponse.json({ error: 'Error al obtener producto' }, { status: 500 });
  if (!row) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });

  const producto = mapProductoRow(row);
  if (!puedePublicarseEnTienda(producto)) {
    return NextResponse.json(
      { error: 'Solo un producto terminado y activo puede publicarse en la tienda' },
      { status: 409 },
    );
  }

  const payload = construirPayloadProductoWC(producto);

  try {
    const publicado = producto.wcProductId
      ? await actualizarProductoWC(producto.wcProductId, payload)
      : await crearProductoWC(payload);

    const { error: updateError } = await supabaseAdmin
      .from('productos')
      .update({ wc_product_id: publicado.id, wc_sincronizado_en: new Date().toISOString() })
      .eq('id', params.id);
    if (updateError) throw updateError;

    return NextResponse.json({
      ok: true,
      wcProductId: publicado.id,
      permalink: publicado.permalink,
      estado: payload.status,
    });
  } catch (e) {
    console.error(`[POST /api/productos/${params.id}/publicar-tienda]`, e);
    return NextResponse.json(
      { error: 'Error al publicar en la tienda', detalle: (e as Error).message },
      { status: 500 },
    );
  }
}
