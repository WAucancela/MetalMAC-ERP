/**
 * GET   /api/pedidos-tienda/[id] — detalle del pedido con sus líneas
 * PATCH /api/pedidos-tienda/[id] — marcar CONTACTADO / PAGADO / ENTREGADO / CANCELADO
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getAuthenticatedUser } from '@/app/api/_helpers';
import { ActualizarEstadoPedidoTiendaSchema } from '@/lib/validations/pedidos-tienda.schema';
import { mapPedidoTiendaRow } from '@/lib/services/mappers';

export const dynamic = 'force-dynamic';

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
      .from('pedidos_tienda')
      .select('*, pedido_tienda_lineas(*)')
      .eq('id', params.id)
      .maybeSingle();
    if (error) throw error;
    if (!pedido) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });

    return NextResponse.json({ ok: true, data: mapPedidoTiendaRow(pedido, pedido.pedido_tienda_lineas) });
  } catch (e) {
    console.error(`[GET /api/pedidos-tienda/${params.id}]`, e);
    return NextResponse.json({ error: 'Error al obtener pedido' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!puedeRevisarPedidos(user.rol)) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const parsed = ActualizarEstadoPedidoTiendaSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 });

  const { estado, notas } = parsed.data;

  try {
    const { data: pedido, error: findError } = await supabaseAdmin
      .from('pedidos_tienda')
      .select('id')
      .eq('id', params.id)
      .maybeSingle();
    if (findError) throw findError;
    if (!pedido) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });

    const { error: updateError } = await supabaseAdmin
      .from('pedidos_tienda')
      .update({ estado, ...(notas !== undefined ? { notas } : {}) })
      .eq('id', params.id);
    if (updateError) throw updateError;

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(`[PATCH /api/pedidos-tienda/${params.id}]`, e);
    return NextResponse.json({ error: 'Error al actualizar pedido' }, { status: 500 });
  }
}
