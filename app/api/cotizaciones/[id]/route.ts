/**
 * GET    /api/cotizaciones/[id] — obtiene una cotización con líneas
 * PUT    /api/cotizaciones/[id] — edita una cotización (solo en BORRADOR — una vez
 *                                  enviada, el número/precio que vio el cliente ya
 *                                  no debería cambiar por debajo sin que se entere)
 * DELETE /api/cotizaciones/[id] — elimina una cotización (solo en BORRADOR)
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getAuthenticatedUser, canWrite, puedeGestionarFinanzas } from '@/app/api/_helpers';
import { ActualizarCotizacionSchema } from '@/lib/validations/cotizaciones.schema';
import { mapCotizacionRow } from '@/lib/services/mappers';
import type { Database } from '@/types/supabase.types';

// Nunca cachear: cada respuesta depende del usuario autenticado y de datos que cambian por request.
export const dynamic = 'force-dynamic';

const IVA_ECUADOR = 0.15;

type CotizacionUpdate = Database['public']['Tables']['cotizaciones']['Update'];

interface RouteParams { params: { id: string } }

export async function GET(request: Request, { params }: RouteParams) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const { data: cotizacion, error } = await supabaseAdmin
      .from('cotizaciones')
      .select('*, cotizacion_lineas(*)')
      .eq('id', params.id)
      .maybeSingle();
    if (error) throw error;
    if (!cotizacion) return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });

    return NextResponse.json({ ok: true, data: mapCotizacionRow(cotizacion, cotizacion.cotizacion_lineas) });
  } catch (e) {
    console.error(`[GET /api/cotizaciones/${params.id}]`, e);
    return NextResponse.json({ error: 'Error al obtener la cotización' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canWrite(user) && !puedeGestionarFinanzas(user)) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
  }

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const parsed = ActualizarCotizacionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 });

  try {
    const { data: existente, error: fetchError } = await supabaseAdmin
      .from('cotizaciones')
      .select('id, estado')
      .eq('id', params.id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!existente) return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });
    if (existente.estado !== 'BORRADOR') {
      return NextResponse.json({ error: 'Solo se puede editar una cotización en borrador' }, { status: 409 });
    }

    const data = parsed.data;
    const update: CotizacionUpdate = {};
    if (data.clienteNombre !== undefined)    update.cliente_nombre = data.clienteNombre;
    if (data.clienteEmail !== undefined)     update.cliente_email = data.clienteEmail;
    if (data.clienteWhatsapp !== undefined)  update.cliente_whatsapp = data.clienteWhatsapp;
    if (data.proyectoId !== undefined)       update.proyecto_id = data.proyectoId;
    if (data.fechaEmision !== undefined)     update.fecha_emision = data.fechaEmision;
    if (data.fechaVencimiento !== undefined) update.fecha_vencimiento = data.fechaVencimiento;
    if (data.notas !== undefined)            update.notas = data.notas;

    if (data.lineas !== undefined) {
      const lineasConSubtotal = data.lineas.map((l) => ({
        ...l,
        subtotal: Math.round(l.cantidad * l.precioUnitario * 100) / 100,
      }));
      const subtotalSinIva = Math.round(lineasConSubtotal.reduce((acc, l) => acc + l.subtotal, 0) * 100) / 100;
      const iva = Math.round(subtotalSinIva * IVA_ECUADOR * 100) / 100;
      update.subtotal_sin_iva = subtotalSinIva;
      update.iva = iva;
      update.total = Math.round((subtotalSinIva + iva) * 100) / 100;

      const { error: delError } = await supabaseAdmin.from('cotizacion_lineas').delete().eq('cotizacion_id', params.id);
      if (delError) throw delError;
      const { error: insError } = await supabaseAdmin.from('cotizacion_lineas').insert(
        lineasConSubtotal.map((l, orden) => ({
          cotizacion_id: params.id,
          orden,
          descripcion: l.descripcion,
          cantidad: l.cantidad,
          precio_unitario: l.precioUnitario,
          subtotal: l.subtotal,
          producto_id: l.productoId,
          material_id: l.materialId,
        })),
      );
      if (insError) throw insError;
    }

    if (Object.keys(update).length > 0) {
      const { error: updError } = await supabaseAdmin.from('cotizaciones').update(update).eq('id', params.id);
      if (updError) throw updError;
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(`[PUT /api/cotizaciones/${params.id}]`, e);
    return NextResponse.json({ error: 'Error al actualizar la cotización' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canWrite(user) && !puedeGestionarFinanzas(user)) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
  }

  try {
    const { data: existente, error: fetchError } = await supabaseAdmin
      .from('cotizaciones')
      .select('id, estado')
      .eq('id', params.id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!existente) return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });
    if (existente.estado !== 'BORRADOR') {
      return NextResponse.json({ error: 'Solo se puede eliminar una cotización en borrador' }, { status: 409 });
    }

    const { error } = await supabaseAdmin.from('cotizaciones').delete().eq('id', params.id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(`[DELETE /api/cotizaciones/${params.id}]`, e);
    return NextResponse.json({ error: 'Error al eliminar la cotización' }, { status: 500 });
  }
}
