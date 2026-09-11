/**
 * GET  /api/clientes  — lista paginada de clientes
 * POST /api/clientes  — crea un cliente
 */
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getAuthenticatedUser, canWrite } from '@/app/api/_helpers';
import { ClienteSchema, ClientesQuerySchema } from '@/lib/validations/clientes.schema';
import { mapClienteRow } from '@/lib/services/mappers';

// Nunca cachear: cada respuesta depende del usuario autenticado y de datos que cambian por request.
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const qp = ClientesQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!qp.success) return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });

  const { activo, q: term, limit: pageLimit, page } = qp.data;

  try {
    let query = supabaseAdmin.from('clientes').select('*', { count: 'exact' }).order('razon_social');
    if (activo !== undefined) query = query.eq('activo', activo);
    if (term) {
      query = query.or(
        `razon_social.ilike.%${term}%,nombre_comercial.ilike.%${term}%,identificacion.ilike.%${term}%,email.ilike.%${term}%`,
      );
    }
    const from = (page - 1) * pageLimit;
    const to   = from + pageLimit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) throw error;

    return NextResponse.json({
      ok: true,
      data: (data ?? []).map(mapClienteRow),
      total: count ?? 0,
      page,
      limit: pageLimit,
    });
  } catch (e) {
    console.error('[GET /api/clientes]', e);
    return NextResponse.json({ error: 'Error al obtener clientes' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user)           return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const parsed = ClienteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 });

  try {
    const { data: cliente, error } = await supabaseAdmin
      .from('clientes')
      .insert({
        tipo_identificacion: parsed.data.tipoIdentificacion,
        identificacion: parsed.data.identificacion || null,
        razon_social: parsed.data.razonSocial,
        nombre_comercial: parsed.data.nombreComercial,
        email: parsed.data.email,
        telefono: parsed.data.telefono,
        whatsapp: parsed.data.whatsapp,
        direccion: parsed.data.direccion,
        ciudad: parsed.data.ciudad,
        notas: parsed.data.notas,
        activo: parsed.data.activo,
        creado_por: user.uid,
      })
      .select()
      .single();

    if (error) {
      // Violación del índice único parcial de `identificacion`.
      if (error.code === '23505') {
        return NextResponse.json(
          { error: `Ya existe un cliente con la identificación ${parsed.data.identificacion}` },
          { status: 409 },
        );
      }
      throw error;
    }

    return NextResponse.json({ ok: true, id: cliente.id }, { status: 201 });
  } catch (e) {
    console.error('[POST /api/clientes]', e);
    return NextResponse.json({ error: 'Error al crear cliente' }, { status: 500 });
  }
}
