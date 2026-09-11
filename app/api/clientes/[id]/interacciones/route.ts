/**
 * POST /api/clientes/[id]/interacciones — agrega una entrada al timeline del
 * cliente (llamada, email, reunión, nota). El listado se trae junto con el
 * detalle del cliente en GET /api/clientes/[id], así que acá solo hay POST.
 */
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getAuthenticatedUser, canWrite } from '@/app/api/_helpers';
import { InteraccionSchema } from '@/lib/validations/clientes.schema';
import { mapInteraccionRow } from '@/lib/services/mappers';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getAuthenticatedUser(request);
  if (!user)           return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const parsed = InteraccionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 });

  try {
    const { data: existe, error: existeError } = await supabaseAdmin
      .from('clientes').select('id').eq('id', params.id).maybeSingle();
    if (existeError) throw existeError;
    if (!existe) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });

    const { data: interaccion, error } = await supabaseAdmin
      .from('clientes_interacciones')
      .insert({
        cliente_id: params.id,
        tipo: parsed.data.tipo,
        descripcion: parsed.data.descripcion,
        creado_por: user.uid,
      })
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ ok: true, data: mapInteraccionRow(interaccion) }, { status: 201 });
  } catch (e) {
    console.error('[POST /api/clientes/[id]/interacciones]', e);
    return NextResponse.json({ error: 'Error al registrar la interacción' }, { status: 500 });
  }
}
