/**
 * PATCH /api/usuarios/[id] — cambia el rol y/o el estado activo de un usuario.
 *
 * Restringido a GERENTE únicamente. Un GERENTE no puede desactivarse ni
 * quitarse el rol GERENTE a sí mismo — evita quedar todo el sistema sin nadie
 * que pueda administrar cuentas.
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getAuthenticatedUser } from '@/app/api/_helpers';
import { ActualizarUsuarioSchema } from '@/lib/validations/usuarios.schema';

export const dynamic = 'force-dynamic';

function esGerente(rol: string): boolean {
  return rol === 'GERENTE';
}

// ~10 años — GoTrue no tiene un "ban permanente" literal, así que se usa una
// duración larga como equivalente práctico. `ban_duration: 'none'` la revierte.
const BAN_LARGO = '87600h';

interface RouteParams { params: { id: string } }

export async function PATCH(request: Request, { params }: RouteParams) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!esGerente(user.rol)) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const parsed = ActualizarUsuarioSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 });
  const { rol, activo } = parsed.data;

  if (params.id === user.uid) {
    if (activo === false) {
      return NextResponse.json({ error: 'No podés desactivar tu propia cuenta' }, { status: 422 });
    }
    if (rol !== undefined && rol !== 'GERENTE') {
      return NextResponse.json({ error: 'No podés quitarte a vos mismo el rol GERENTE' }, { status: 422 });
    }
  }

  try {
    if (rol !== undefined) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(params.id, { app_metadata: { rol } });
      if (error) throw error;
    }
    if (activo !== undefined) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(params.id, {
        ban_duration: activo ? 'none' : BAN_LARGO,
      });
      if (error) throw error;
    }

    const update: { rol?: typeof rol; activo?: boolean } = {};
    if (rol !== undefined) update.rol = rol;
    if (activo !== undefined) update.activo = activo;

    const { error: perfilError } = await supabaseAdmin.from('perfiles').update(update).eq('id', params.id);
    if (perfilError) throw perfilError;

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(`[PATCH /api/usuarios/${params.id}]`, e);
    return NextResponse.json({ error: 'Error al actualizar el usuario' }, { status: 500 });
  }
}
