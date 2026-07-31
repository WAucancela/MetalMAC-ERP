/**
 * GET   /api/pedidos-woocommerce/[id] — detalle del pedido con sus líneas
 * PATCH /api/pedidos-woocommerce/[id] — marcar EN_REVISION / CONVERTIDO / RECHAZADO
 *
 * La transición a CONVERTIDO normalmente la dispara el endpoint de conversión de línea
 * (.../lineas/[lineaId]/convertir) cuando la última línea queda convertida — este PATCH
 * también la permite manualmente por si el staff quiere cerrar un pedido sin convertir
 * todas las líneas (ej. una línea no aplica a producción).
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getAuthenticatedUser } from '@/app/api/_helpers';
import { ActualizarEstadoRevisionSchema } from '@/lib/validations/pedidos-woocommerce.schema';
import { mapPedidoWooCommerceRow } from '@/lib/services/mappers';

interface RouteParams { params: { id: string } }

function puedeRevisarPedidos(rol: string): boolean {
  return ['GERENTE', 'PRODUCCION'].includes(rol);
}

export async function GET(request: Request, { params }: RouteParams) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!puedeRevisarPedidos(user.rol)) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  try {
    const { data: pedido, error } = await supabaseAdmin
      .from('pedidos_woocommerce')
      .select('*, pedido_woocommerce_lineas(*)')
      .eq('id', params.id)
      .maybeSingle();
    if (error) throw error;
    if (!pedido) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });

    return NextResponse.json({ ok: true, data: mapPedidoWooCommerceRow(pedido, pedido.pedido_woocommerce_lineas) });
  } catch (e) {
    console.error(`[GET /api/pedidos-woocommerce/${params.id}]`, e);
    return NextResponse.json({ error: 'Error al obtener pedido' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!puedeRevisarPedidos(user.rol)) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const parsed = ActualizarEstadoRevisionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 });

  const { estadoRevision, notas } = parsed.data;

  try {
    const { data: pedido, error: pedidoError } = await supabaseAdmin
      .from('pedidos_woocommerce')
      .select('estado_revision, procesado_en')
      .eq('id', params.id)
      .maybeSingle();
    if (pedidoError) throw pedidoError;
    if (!pedido) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });

    const { error: updateError } = await supabaseAdmin
      .from('pedidos_woocommerce')
      .update({
        estado_revision: estadoRevision,
        ...(notas !== undefined ? { notas } : {}),
        // Registrar quién/cuándo salió de PENDIENTE por primera vez.
        ...(pedido.procesado_en === null
          ? { procesado_en: new Date().toISOString(), procesado_por: user.uid }
          : {}),
      })
      .eq('id', params.id);
    if (updateError) throw updateError;

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(`[PATCH /api/pedidos-woocommerce/${params.id}]`, e);
    return NextResponse.json({ error: 'Error al actualizar pedido' }, { status: 500 });
  }
}
