/**
 * GET /api/pedidos-tienda — lista la bandeja de pedidos de la Tienda de Muebles de
 * tallermac-web (sin pago en línea todavía: el equipo coordina pago y entrega a mano).
 *
 * Sin POST: los pedidos sólo entran desde tallermac-web (app/api/pedido), con la clave
 * anónima de Supabase — nunca creados a mano desde el ERP.
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  getAuthenticatedUser, encodeCursor, decodeCursor, cursorFilterAntesDe,
} from '@/app/api/_helpers';
import { PedidosTiendaQuerySchema } from '@/lib/validations/pedidos-tienda.schema';
import { mapPedidoTiendaRow } from '@/lib/services/mappers';

export const dynamic = 'force-dynamic';

function puedeRevisarPedidos(rol: string): boolean {
  return ['GERENTE', 'PRODUCCION'].includes(rol);
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!puedeRevisarPedidos(user.rol)) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const qp = PedidosTiendaQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!qp.success) return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });

  const { estado, limit: pageLimit, startAfter: cursor } = qp.data;

  try {
    let query = supabaseAdmin
      .from('pedidos_tienda')
      .select('*, pedido_tienda_lineas(*)')
      .order('creado_en', { ascending: false })
      .order('id', { ascending: false });

    if (estado) query = query.eq('estado', estado);

    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (decoded) query = query.or(cursorFilterAntesDe('creado_en', decoded));
    }
    query = query.limit(pageLimit);

    const { data, error } = await query;
    if (error) throw error;

    const rows = data ?? [];
    const pedidos = rows.map((row) => mapPedidoTiendaRow(row, row.pedido_tienda_lineas));

    const last = rows.at(-1);
    const nextCursor =
      rows.length === pageLimit && last
        ? encodeCursor({ valor: last.creado_en, id: last.id })
        : null;

    return NextResponse.json({ ok: true, data: pedidos, nextCursor });
  } catch (e) {
    console.error('[GET /api/pedidos-tienda]', e);
    return NextResponse.json({ error: 'Error al obtener pedidos' }, { status: 500 });
  }
}
