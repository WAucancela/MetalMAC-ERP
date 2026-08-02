/**
 * POST /api/webhooks/woocommerce — recibe pedidos de tallermac.com (WooCommerce).
 *
 * Primer endpoint del repo que NO usa getAuthenticatedUser: la llamada viene del
 * servidor de WooCommerce, no de un usuario logueado, así que se autentica con la
 * firma HMAC del webhook (WOOCOMMERCE_WEBHOOK_SECRET) en vez de un Bearer JWT.
 * middleware.ts ya deja pasar todo /api/* sin sesión de Supabase.
 *
 * Idempotente por wc_order_id: en un reenvío (ej. WooCommerce manda "order.updated"
 * tras "order.created") actualiza sólo los campos de WooCommerce, sin tocar el
 * progreso de revisión (estado_revision/notas/procesado_*) que ya haya hecho el staff.
 * Las líneas ya convertidas en una orden de producción tampoco se tocan.
 */
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { WooCommerceWebhookPayloadSchema } from '@/lib/validations/pedidos-woocommerce.schema';
import { verificarFirmaWebhook, calcularLineasAInsertar } from '@/lib/services/woocommerce.service';
import type { Json } from '@/types/supabase.types';

// Nunca cachear: cada respuesta depende del usuario autenticado y de datos que cambian por request.
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const rawBody = await request.text();

  const secret = process.env.WOOCOMMERCE_WEBHOOK_SECRET;
  const firma = request.headers.get('x-wc-webhook-signature');
  if (!secret || !verificarFirmaWebhook(rawBody, firma, secret)) {
    return NextResponse.json({ error: 'Firma inválida' }, { status: 401 });
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const parsed = WooCommerceWebhookPayloadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Payload inválido', detalles: parsed.error.flatten() }, { status: 400 });
  }
  const pedido = parsed.data;

  try {
    // 1. Upsert de cabecera por wc_order_id — insert primero; si ya existe (23505),
    //    actualizar sólo los campos que vienen de WooCommerce.
    const { data: existente } = await supabaseAdmin
      .from('pedidos_woocommerce')
      .select('id')
      .eq('wc_order_id', pedido.id)
      .maybeSingle();

    let pedidoId: string;

    if (existente) {
      pedidoId = existente.id;
      const { error: updateError } = await supabaseAdmin
        .from('pedidos_woocommerce')
        .update({
          wc_status: pedido.status,
          numero_pedido: pedido.number,
          cliente_nombre: `${pedido.billing.first_name} ${pedido.billing.last_name}`.trim(),
          cliente_email: pedido.billing.email,
          total: Number(pedido.total),
          moneda: pedido.currency,
          payload: pedido as unknown as Json,
        })
        .eq('id', pedidoId);
      if (updateError) throw updateError;
    } else {
      const { data: creado, error: insertError } = await supabaseAdmin
        .from('pedidos_woocommerce')
        .insert({
          wc_order_id: pedido.id,
          wc_status: pedido.status,
          numero_pedido: pedido.number,
          cliente_nombre: `${pedido.billing.first_name} ${pedido.billing.last_name}`.trim(),
          cliente_email: pedido.billing.email,
          total: Number(pedido.total),
          moneda: pedido.currency,
          payload: pedido as unknown as Json,
        })
        .select('id')
        .single();
      if (insertError) throw insertError;
      pedidoId = creado.id;
    }

    // 2. Resolver producto por SKU contra el catálogo actual.
    const skus = [...new Set(pedido.line_items.map((li) => li.sku).filter(Boolean))];
    const { data: productosMatch } = skus.length
      ? await supabaseAdmin.from('productos').select('id, codigo').in('codigo', skus)
      : { data: [] as { id: string; codigo: string }[] };
    const productosPorCodigo = new Map(
      (productosMatch ?? []).map((p) => [p.codigo.trim().toLowerCase(), p.id]),
    );

    // 3. No pisar líneas ya convertidas en una orden de producción.
    const { data: lineasConvertidas } = await supabaseAdmin
      .from('pedido_woocommerce_lineas')
      .select('wc_line_item_id')
      .eq('pedido_id', pedidoId)
      .not('orden_produccion_id', 'is', null);

    const lineasAInsertar = calcularLineasAInsertar(
      pedido.line_items,
      (lineasConvertidas ?? []).map((l) => ({ wcLineItemId: l.wc_line_item_id })),
    );

    // Delete + insert en una sola función: si el reenvío llegara a fallar a mitad de
    // camino, el pedido nunca queda transitoriamente sin líneas (ver comentario en la
    // migración 20260730120000_pedidos_woocommerce_rpc_atomicidad.sql).
    const { error: syncError } = await supabaseAdmin.rpc('reemplazar_lineas_pendientes_pedido_woocommerce', {
      p_pedido_id: pedidoId,
      p_lineas: lineasAInsertar.map((li) => ({
        wcLineItemId: li.id,
        sku: li.sku,
        nombreProducto: li.name,
        cantidad: li.quantity,
        productoId: productosPorCodigo.get(li.sku.trim().toLowerCase()) ?? null,
      })),
    });
    if (syncError) throw syncError;

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[POST /api/webhooks/woocommerce]', e);
    // 500 → WooCommerce reintenta la entrega más tarde.
    return NextResponse.json({ error: 'Error al procesar el pedido' }, { status: 500 });
  }
}
