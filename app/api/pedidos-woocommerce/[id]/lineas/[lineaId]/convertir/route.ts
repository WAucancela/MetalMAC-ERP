/**
 * POST /api/pedidos-woocommerce/[id]/lineas/[lineaId]/convertir
 *
 * Convierte una línea del pedido en una Orden de Producción, reusando el mismo RPC
 * `crear_orden_produccion` que app/api/ordenes-produccion/route.ts (mismo manejo de
 * BOM_NO_ENCONTRADO → 422). Tras crear la OP, fija producto_id/orden_produccion_id en
 * la línea; si con esto todas las líneas del pedido quedan convertidas, marca el pedido
 * como CONVERTIDO.
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getAuthenticatedUser } from '@/app/api/_helpers';
import { ConvertirLineaPedidoSchema } from '@/lib/validations/pedidos-woocommerce.schema';

interface RouteParams { params: { id: string; lineaId: string } }

function puedeRevisarPedidos(rol: string): boolean {
  return ['GERENTE', 'PRODUCCION'].includes(rol);
}

export async function POST(request: Request, { params }: RouteParams) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!puedeRevisarPedidos(user.rol)) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const parsed = ConvertirLineaPedidoSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 });

  const { productoId, cantidad, fechaEntrega, proyectoId, notas } = parsed.data;

  try {
    // Todo el check-then-act (línea no convertida, producto existe, crear OP, fijar
    // orden_produccion_id, cerrar el pedido si no quedan líneas pendientes) vive en un
    // único RPC con `for update` sobre la línea — evita que dos requests casi
    // simultáneos (doble click, dos pestañas) generen dos órdenes para la misma línea.
    const { data: orden, error: rpcError } = await supabaseAdmin.rpc('convertir_linea_pedido_woocommerce', {
      p_linea_id: params.lineaId,
      p_pedido_id: params.id,
      p_producto_id: productoId,
      p_cantidad: cantidad,
      p_fecha_entrega: fechaEntrega,
      p_proyecto_id: (proyectoId ?? null) as string,
      p_notas: notas,
      p_usuario_id: user.uid,
    });

    if (rpcError) {
      if (rpcError.message.startsWith('LINEA_NO_ENCONTRADA')) {
        return NextResponse.json({ error: 'Línea no encontrada' }, { status: 404 });
      }
      if (rpcError.message.startsWith('LINEA_YA_CONVERTIDA')) {
        return NextResponse.json({ error: 'Esta línea ya fue convertida en una orden de producción' }, { status: 409 });
      }
      if (rpcError.message.startsWith('PRODUCTO_NO_ENCONTRADO')) {
        return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
      }
      if (rpcError.message.startsWith('BOM_NO_ENCONTRADO')) {
        return NextResponse.json(
          { error: `El producto no tiene BOM configurado. Configúralo en /productos/${productoId}` },
          { status: 422 },
        );
      }
      throw rpcError;
    }

    return NextResponse.json({ ok: true, ordenId: orden.id, codigo: orden.codigo }, { status: 201 });
  } catch (e) {
    console.error(`[POST /api/pedidos-woocommerce/${params.id}/lineas/${params.lineaId}/convertir]`, e);
    return NextResponse.json({ error: 'Error al convertir línea en orden de producción' }, { status: 500 });
  }
}
