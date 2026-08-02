/**
 * GET /api/pedidos-woocommerce — lista la bandeja de revisión de pedidos de WooCommerce
 *
 * Sin POST: los pedidos sólo entran vía app/api/webhooks/woocommerce, nunca creados a
 * mano desde el ERP.
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  getAuthenticatedUser, encodeCursor, decodeCursor, cursorFilterAntesDe,
} from '@/app/api/_helpers';
import { PedidosWooCommerceQuerySchema } from '@/lib/validations/pedidos-woocommerce.schema';
import { mapPedidoWooCommerceRow } from '@/lib/services/mappers';

// Nunca cachear: cada respuesta depende del usuario autenticado y de datos que cambian por request.
export const dynamic = 'force-dynamic';

/** Revisar la bandeja de pedidos es un permiso de producción, no el `canWrite` genérico
 *  (GERENTE|BODEGUERO) de _helpers.ts, que corresponde a otros módulos. */
function puedeRevisarPedidos(rol: string): boolean {
  return ['GERENTE', 'PRODUCCION'].includes(rol);
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!puedeRevisarPedidos(user.rol)) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const qp = PedidosWooCommerceQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!qp.success) return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });

  const { estadoRevision, limit: pageLimit, startAfter: cursor } = qp.data;

  try {
    let query = supabaseAdmin
      .from('pedidos_woocommerce')
      .select('*, pedido_woocommerce_lineas(*)')
      .order('recibido_en', { ascending: false })
      .order('id', { ascending: false });

    if (estadoRevision) query = query.eq('estado_revision', estadoRevision);

    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (decoded) query = query.or(cursorFilterAntesDe('recibido_en', decoded));
    }
    query = query.limit(pageLimit);

    const { data, error } = await query;
    if (error) throw error;

    const rows = data ?? [];
    const pedidos = rows.map((row) => mapPedidoWooCommerceRow(row, row.pedido_woocommerce_lineas));

    const last = rows.at(-1);
    const nextCursor =
      rows.length === pageLimit && last
        ? encodeCursor({ valor: last.recibido_en, id: last.id })
        : null;

    return NextResponse.json({
      ok: true,
      data: pedidos,
      nextCursor,
      __debug: {
        estadoRevision,
        rawRowCount: rows.length,
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      },
    });
  } catch (e) {
    console.error('[GET /api/pedidos-woocommerce]', e);
    return NextResponse.json({ error: 'Error al obtener pedidos' }, { status: 500 });
  }
}
