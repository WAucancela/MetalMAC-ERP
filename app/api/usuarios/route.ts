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
    // El usuario de auth ya se creó — no lo revertimos (el rol/perfil se puede
    // corregir aparte); reportamos el problema para que quede claro.
    console.error('[POST /api/usuarios] usuario creado en auth pero falló el espejo en perfiles', perfilError);
    return NextResponse.json({ error: 'Usuario creado pero no se pudo guardar su perfil' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data: { id: creado.user.id, email, rol } }, { status: 201 });
}
