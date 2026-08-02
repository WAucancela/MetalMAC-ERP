/**
 * GET   /api/contabilidad/facturas-venta/[id] — obtiene una factura de venta con líneas
 * PATCH /api/contabilidad/facturas-venta/[id] — anular, o marcar como emitida
 *
 * PATCH acepta dos formas de body (Fase 1, sin emisión electrónica automática):
 *   { estado: 'ANULADA' }                        — anula la factura
 *   { numeroFactura, claveAcceso }                — la marca EMITIDA con lo que el
 *                                                    staff obtuvo del portal del SRI
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getAuthenticatedUser, canWrite } from '@/app/api/_helpers';
import { MarcarEmitidaSchema } from '@/lib/validations/ventas.schema';
import { mapFacturaVentaRow } from '@/lib/services/mappers';
import { z } from 'zod';

// Nunca cachear: cada respuesta depende del usuario autenticado y de datos que cambian por request.
export const dynamic = 'force-dynamic';

const AnularSchema = z.object({ estado: z.literal('ANULADA') });

interface RouteParams { params: { id: string } }

export async function GET(request: Request, { params }: RouteParams) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const { data: factura, error } = await supabaseAdmin
      .from('facturas_venta')
      .select('*, factura_venta_lineas(*)')
      .eq('id', params.id)
      .maybeSingle();
    if (error) throw error;
    if (!factura) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });

    return NextResponse.json({ ok: true, data: mapFacturaVentaRow(factura, factura.factura_venta_lineas) });
  } catch (e) {
    console.error(`[GET /api/contabilidad/facturas-venta/${params.id}]`, e);
    return NextResponse.json({ error: 'Error al obtener factura' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const user = await getAuthenticatedUser(request);
  if (!user)           return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ error: 'Sin permiso de escritura' }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  try {
    const { data: factura, error: fetchError } = await supabaseAdmin
      .from('facturas_venta')
      .select('id, estado')
      .eq('id', params.id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!factura) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });

    const anular = AnularSchema.safeParse(body);
    if (anular.success) {
      if (factura.estado === 'ANULADA') {
        return NextResponse.json({ error: 'La factura ya está anulada' }, { status: 409 });
      }
      const { error } = await supabaseAdmin
        .from('facturas_venta')
        .update({ estado: 'ANULADA' })
        .eq('id', params.id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    const emitida = MarcarEmitidaSchema.safeParse(body);
    if (emitida.success) {
      if (factura.estado !== 'BORRADOR') {
        return NextResponse.json({ error: 'Solo se puede emitir una factura que esté en borrador' }, { status: 409 });
      }

      const [establecimiento, puntoEmision, secuencialStr] = emitida.data.numeroFactura.split('-');

      const { error } = await supabaseAdmin
        .from('facturas_venta')
        .update({
          estado: 'EMITIDA',
          numero_factura: emitida.data.numeroFactura,
          clave_acceso: emitida.data.claveAcceso,
          establecimiento,
          punto_emision: puntoEmision,
          secuencial: Number(secuencialStr),
        })
        .eq('id', params.id);

      if (error) {
        if (error.code === '23505') {
          return NextResponse.json(
            { error: 'Ya existe una factura registrada con esa clave de acceso' },
            { status: 409 },
          );
        }
        throw error;
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Datos inválidos', detalles: emitida.error?.flatten() }, { status: 400 });
  } catch (e) {
    console.error(`[PATCH /api/contabilidad/facturas-venta/${params.id}]`, e);
    return NextResponse.json({ error: 'Error al actualizar factura' }, { status: 500 });
  }
}
