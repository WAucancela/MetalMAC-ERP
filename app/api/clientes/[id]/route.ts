/**
 * GET    /api/clientes/[id]  — detalle de cliente + historial unificado
 *                              (cotizaciones, proyectos, facturas de venta,
 *                              pedidos web, interacciones) — el "360°" del CRM.
 * PUT    /api/clientes/[id]  — actualiza cliente
 * DELETE /api/clientes/[id]  — soft delete (activo: false)
 */
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getAuthenticatedUser, canWrite } from '@/app/api/_helpers';
import { ClienteSchema } from '@/lib/validations/clientes.schema';
import { mapClienteRow, mapInteraccionRow } from '@/lib/services/mappers';
import type { Database } from '@/types/supabase.types';

// Nunca cachear: cada respuesta depende del usuario autenticado y de datos que cambian por request.
export const dynamic = 'force-dynamic';

type ClienteUpdate = Database['public']['Tables']['clientes']['Update'];

// Cuántos registros recientes de cada tipo se traen para el historial — no es
// una vista paginada, es un vistazo rápido; el detalle completo de cada
// cotización/proyecto/factura se ve navegando a su propia página.
const HISTORIAL_LIMIT = 15;

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const [
    { data: clienteRow, error: clienteError },
    { data: cotizacionesRows, error: cotizacionesError },
    { data: proyectosRows, error: proyectosError },
    { data: facturasRows, error: facturasError },
    { data: pedidosRows, error: pedidosError },
    { data: interaccionesRows, error: interaccionesError },
  ] = await Promise.all([
    supabaseAdmin.from('clientes').select('*').eq('id', params.id).maybeSingle(),
    supabaseAdmin
      .from('cotizaciones')
      .select('id, numero, estado, fecha_emision, fecha_vencimiento, total')
      .eq('cliente_id', params.id)
      .order('fecha_emision', { ascending: false })
      .limit(HISTORIAL_LIMIT),
    supabaseAdmin
      .from('proyectos')
      .select('id, codigo, nombre, estado, fecha_inicio, presupuesto, costo_real')
      .eq('cliente_id', params.id)
      .order('fecha_inicio', { ascending: false })
      .limit(HISTORIAL_LIMIT),
    supabaseAdmin
      .from('facturas_venta')
      .select('id, numero_factura, estado, fecha_emision, total')
      .eq('cliente_id', params.id)
      .order('fecha_emision', { ascending: false })
      .limit(HISTORIAL_LIMIT),
    supabaseAdmin
      .from('pedidos_woocommerce')
      .select('id, numero_pedido, wc_status, estado_revision, total, moneda, recibido_en')
      .eq('cliente_id', params.id)
      .order('recibido_en', { ascending: false })
      .limit(HISTORIAL_LIMIT),
    supabaseAdmin
      .from('clientes_interacciones')
      .select('*')
      .eq('cliente_id', params.id)
      .order('creado_en', { ascending: false })
      .limit(50),
  ]);

  if (clienteError)       return NextResponse.json({ error: 'Error al obtener cliente' }, { status: 500 });
  if (!clienteRow)        return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
  if (cotizacionesError)  return NextResponse.json({ error: 'Error al obtener cotizaciones' }, { status: 500 });
  if (proyectosError)     return NextResponse.json({ error: 'Error al obtener proyectos' }, { status: 500 });
  if (facturasError)      return NextResponse.json({ error: 'Error al obtener facturas' }, { status: 500 });
  if (pedidosError)       return NextResponse.json({ error: 'Error al obtener pedidos' }, { status: 500 });
  if (interaccionesError) return NextResponse.json({ error: 'Error al obtener interacciones' }, { status: 500 });

  return NextResponse.json({
    ok: true,
    data: {
      cliente: mapClienteRow(clienteRow),
      cotizaciones: (cotizacionesRows ?? []).map((r) => ({
        id: r.id, numero: r.numero, estado: r.estado,
        fechaEmision: r.fecha_emision, fechaVencimiento: r.fecha_vencimiento, total: Number(r.total),
      })),
      proyectos: (proyectosRows ?? []).map((r) => ({
        id: r.id, codigo: r.codigo, nombre: r.nombre, estado: r.estado,
        fechaInicio: r.fecha_inicio, presupuesto: Number(r.presupuesto), costoReal: Number(r.costo_real),
      })),
      facturas: (facturasRows ?? []).map((r) => ({
        id: r.id, numeroFactura: r.numero_factura, estado: r.estado,
        fechaEmision: r.fecha_emision, total: Number(r.total),
      })),
      pedidosWeb: (pedidosRows ?? []).map((r) => ({
        id: r.id, numeroPedido: r.numero_pedido, wcStatus: r.wc_status, estadoRevision: r.estado_revision,
        total: Number(r.total), moneda: r.moneda, recibidoEn: r.recibido_en,
      })),
      interacciones: (interaccionesRows ?? []).map(mapInteraccionRow),
    },
  });
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getAuthenticatedUser(request);
  if (!user)           return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const parsed = ClienteSchema.partial().safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 });

  const update: ClienteUpdate = {};
  if (parsed.data.tipoIdentificacion !== undefined) update.tipo_identificacion = parsed.data.tipoIdentificacion;
  if (parsed.data.identificacion !== undefined)     update.identificacion = parsed.data.identificacion || null;
  if (parsed.data.razonSocial !== undefined)        update.razon_social = parsed.data.razonSocial;
  if (parsed.data.nombreComercial !== undefined)    update.nombre_comercial = parsed.data.nombreComercial;
  if (parsed.data.email !== undefined)              update.email = parsed.data.email;
  if (parsed.data.telefono !== undefined)           update.telefono = parsed.data.telefono;
  if (parsed.data.whatsapp !== undefined)           update.whatsapp = parsed.data.whatsapp;
  if (parsed.data.direccion !== undefined)          update.direccion = parsed.data.direccion;
  if (parsed.data.ciudad !== undefined)             update.ciudad = parsed.data.ciudad;
  if (parsed.data.notas !== undefined)              update.notas = parsed.data.notas;
  if (parsed.data.activo !== undefined)             update.activo = parsed.data.activo;

  try {
    const { data: updated, error } = await supabaseAdmin
      .from('clientes')
      .update(update)
      .eq('id', params.id)
      .select()
      .maybeSingle();
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: `Ya existe un cliente con esa identificación` }, { status: 409 });
      }
      throw error;
    }
    if (!updated) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[PUT /api/clientes/[id]]', e);
    return NextResponse.json({ error: 'Error al actualizar cliente' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getAuthenticatedUser(request);
  if (!user)           return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  const { data: updated, error } = await supabaseAdmin
    .from('clientes')
    .update({ activo: false })
    .eq('id', params.id)
    .select()
    .maybeSingle();
  if (error)    return NextResponse.json({ error: 'Error al desactivar cliente' }, { status: 500 });
  if (!updated) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });

  return NextResponse.json({ ok: true });
}
