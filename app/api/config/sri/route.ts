/**
 * GET /api/config/sri — estado de la configuración SRI/Resend
 * PUT /api/config/sri — guarda/actualiza la configuración
 *
 * Restringido a GERENTE únicamente (mismo criterio que
 * app/api/config/certificado-firma/route.ts: es configuración sensible de todo
 * el taller, no una operación de escritura de negocio normal).
 */

import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers';
import { ConfiguracionSRISchema } from '@/lib/validations/configuracion-sri.schema';
import { guardarConfiguracionSRI, obtenerEstadoConfiguracionSRI } from '@/lib/services/configuracion-sri.service';

// Nunca cachear: cada respuesta depende del usuario autenticado y de datos que cambian por request.
export const dynamic = 'force-dynamic';

function esGerente(rol: string): boolean {
  return rol === 'GERENTE';
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!esGerente(user.rol)) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  try {
    const estado = await obtenerEstadoConfiguracionSRI();
    return NextResponse.json({ ok: true, data: estado });
  } catch (e) {
    console.error('[GET /api/config/sri]', e);
    return NextResponse.json({ error: 'Error al obtener la configuración' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!esGerente(user.rol)) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const parsed = ConfiguracionSRISchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await guardarConfiguracionSRI(parsed.data, user.uid);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[PUT /api/config/sri]', e);
    return NextResponse.json({ error: 'Error al guardar la configuración' }, { status: 500 });
  }
}
