/**
 * POST /api/cotizaciones/generar-ia
 *
 * Recibe el pedido de un cliente en lenguaje natural y devuelve líneas de
 * cotización sugeridas, matcheadas contra el catálogo real de Productos
 * activos — no crea ni guarda nada, solo sugiere para que el staff revise
 * antes de guardar la cotización (ver cotizacion-ia.service.ts).
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getAuthenticatedUser, canWrite } from '@/app/api/_helpers';
import { GenerarLineasIASchema } from '@/lib/validations/cotizaciones.schema';
import { generarLineasCotizacionIA, type ProductoCatalogoIA } from '@/lib/services/cotizacion-ia.service';

// Nunca cachear: cada respuesta depende del catálogo actual y del texto enviado.
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user)           return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ error: 'Sin permiso de escritura' }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const parsed = GenerarLineasIASchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const { data: productos, error } = await supabaseAdmin
      .from('productos')
      .select('id, codigo, nombre, descripcion, precio_venta, unidad_venta')
      .eq('activo', true)
      .limit(200);
    if (error) throw error;

    const catalogo: ProductoCatalogoIA[] = (productos ?? []).map((p) => ({
      id: p.id,
      codigo: p.codigo,
      nombre: p.nombre,
      descripcion: p.descripcion ?? '',
      precioVenta: Number(p.precio_venta),
      unidadVenta: p.unidad_venta,
    }));

    const resultado = await generarLineasCotizacionIA(parsed.data.textoCliente, catalogo);
    return NextResponse.json({ ok: true, data: resultado });
  } catch (e) {
    console.error('[POST /api/cotizaciones/generar-ia]', e);
    const mensaje = e instanceof Error ? e.message : 'Error al generar la cotización con IA';
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}
