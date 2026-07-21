/**
 * GET  /api/proyectos  — lista proyectos con filtros
 * POST /api/proyectos  — crea proyecto (solo GERENTE/BODEGUERO, vía canWrite)
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  getAuthenticatedUser, canWrite, encodeCursor, decodeCursor, cursorFilterAntesDe,
} from '@/app/api/_helpers';
import { ProyectoSchema, ProyectosQuerySchema } from '@/lib/validations/proyectos.schema';
import { mapProyectoRow } from '@/lib/services/mappers';

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const qp = ProyectosQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!qp.success) return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });

  const { estado, cliente, limit: pageLimit, startAfter: cursor } = qp.data;

  try {
    let query = supabaseAdmin
      .from('proyectos')
      .select('*')
      .order('fecha_inicio', { ascending: false })
      .order('id', { ascending: false });

    if (estado) query = query.eq('estado', estado);
    // `cliente` no está indexado (dataset chico, un solo taller) — igual que la
    // versión Firestore, se filtra en memoria; el resto de filtros sí van en la query.
    if (cliente) query = query.ilike('cliente', `%${cliente}%`);

    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (decoded) query = query.or(cursorFilterAntesDe('fecha_inicio', decoded));
    }
    query = query.limit(pageLimit);

    const { data, error } = await query;
    if (error) throw error;

    const rows = data ?? [];
    const last = rows.at(-1);
    const nextCursor =
      rows.length === pageLimit && last
        ? encodeCursor({ valor: last.fecha_inicio, id: last.id })
        : null;

    return NextResponse.json({ ok: true, data: rows.map(mapProyectoRow), nextCursor });
  } catch (e) {
    console.error('[GET /api/proyectos]', e);
    return NextResponse.json({ error: 'Error al obtener proyectos' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user)           return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const parsed = ProyectoSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 });

  const { nombre, descripcion, cliente, presupuesto, estado, fechaInicio, fechaFin } = parsed.data;

  try {
    // Contador anual + insert en una sola transacción implícita (RPC). El estado
    // inicial siempre es PLANIFICACION dentro de la función; si el request pidió
    // otro estado explícitamente, se aplica con un update posterior.
    const { data: proyecto, error } = await supabaseAdmin.rpc('crear_proyecto', {
      p_nombre: nombre,
      p_descripcion: descripcion,
      p_cliente: cliente,
      p_presupuesto: presupuesto,
      p_costo_estimado: 0,
      p_fecha_inicio: fechaInicio,
      p_responsable_id: user.uid,
      p_usuario_id: user.uid,
    });
    if (error) throw error;

    if (estado && estado !== 'PLANIFICACION') {
      await supabaseAdmin.from('proyectos').update({ estado }).eq('id', proyecto.id);
    }
    if (fechaFin) {
      await supabaseAdmin.from('proyectos').update({ fecha_fin: fechaFin }).eq('id', proyecto.id);
    }

    return NextResponse.json({ ok: true, id: proyecto.id, codigo: proyecto.codigo }, { status: 201 });
  } catch (e) {
    console.error('[POST /api/proyectos]', e);
    return NextResponse.json({ error: 'Error al crear proyecto' }, { status: 500 });
  }
}
