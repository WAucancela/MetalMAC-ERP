import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getAuthenticatedUser, canWrite } from '@/app/api/_helpers';
import { ProductoSchema, ProductosQuerySchema } from '@/lib/validations/produccion.schema';
import { mapProductoRow } from '@/lib/services/mappers';

// Nunca cachear: cada respuesta depende del usuario autenticado y de datos que cambian por request.
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const qp = ProductosQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!qp.success) return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });

  const { tipo, activo, q: term, limit: pageLimit } = qp.data;

  try {
    let query = supabaseAdmin.from('productos').select('*').order('nombre');
    if (tipo)                 query = query.eq('tipo', tipo);
    if (activo !== undefined) query = query.eq('activo', activo);
    if (term)                 query = query.or(`nombre.ilike.%${term}%,codigo.ilike.%${term}%`);
    query = query.limit(pageLimit);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ ok: true, data: (data ?? []).map(mapProductoRow) });
  } catch (e) {
    console.error('[GET /api/productos]', e);
    return NextResponse.json({ error: 'Error al obtener productos' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user)           return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const parsed = ProductoSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 });

  try {
    const { data: producto, error } = await supabaseAdmin
      .from('productos')
      .insert({
        codigo: parsed.data.codigo,
        nombre: parsed.data.nombre,
        descripcion: parsed.data.descripcion,
        tipo: parsed.data.tipo,
        unidad_venta: parsed.data.unidadVenta,
        precio_venta: parsed.data.precioVenta,
        activo: parsed.data.activo,
      })
      .select()
      .single();

    if (error) {
      // Violación de unicidad de `codigo` (equivalente al pre-chequeo + 409 de la versión Firestore)
      if (error.code === '23505') {
        return NextResponse.json({ error: `Código ${parsed.data.codigo} ya existe` }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({ ok: true, id: producto.id }, { status: 201 });
  } catch (e) {
    console.error('[POST /api/productos]', e);
    return NextResponse.json({ error: 'Error al crear producto' }, { status: 500 });
  }
}
