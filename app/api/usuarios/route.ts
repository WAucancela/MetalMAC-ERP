/**
 * GET  /api/usuarios — lista de usuarios (desde el espejo `perfiles`)
 * POST /api/usuarios — crea un usuario nuevo con contraseña temporal
 *
 * Restringido a GERENTE únicamente — administración de cuentas/roles es
 * configuración sensible de todo el taller, mismo criterio que
 * app/api/config/sri/route.ts.
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getAuthenticatedUser } from '@/app/api/_helpers';
import { CrearUsuarioSchema } from '@/lib/validations/usuarios.schema';

export const dynamic = 'force-dynamic';

function esGerente(rol: string): boolean {
  return rol === 'GERENTE';
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!esGerente(user.rol)) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from('perfiles')
    .select('*')
    .order('creado_en', { ascending: true });
  if (error) return NextResponse.json({ error: 'Error al obtener usuarios' }, { status: 500 });

  return NextResponse.json({ ok: true, data });
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!esGerente(user.rol)) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const parsed = CrearUsuarioSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 });

  const { email, password, rol } = parsed.data;

  const { data: creado, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // la contraseña temporal se entrega en persona, no por link de invitación
    app_metadata: { rol },
  });
  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 409 });
  }

  const { error: perfilError } = await supabaseAdmin
    .from('perfiles')
    .insert({ id: creado.user.id, email, rol, activo: true });
  if (perfilError) {
    // Compensar: si el espejo en `perfiles` no se pudo guardar, no dejar un usuario
    // de Auth huérfano (sin fila en perfiles, invisible para el resto del ERP pero
    // igual capaz de loguearse) — se revierte la creación en Auth y se reporta el
    // error tal cual, para reintentar limpio.
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(creado.user.id);
    if (deleteError) {
      console.error(
        '[POST /api/usuarios] usuario creado en auth, falló el espejo en perfiles, Y falló la reversión — queda huérfano',
        { perfilError, deleteError, userId: creado.user.id },
      );
      return NextResponse.json({ error: 'Usuario creado pero no se pudo guardar su perfil (y no se pudo revertir)' }, { status: 500 });
    }
    console.error('[POST /api/usuarios] falló el espejo en perfiles — se revirtió la creación en auth', perfilError);
    return NextResponse.json({ error: 'No se pudo crear el usuario — intentá de nuevo' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data: { id: creado.user.id, email, rol } }, { status: 201 });
}
