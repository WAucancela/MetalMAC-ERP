/**
 * GET /api/unidades-medida — lista todas las unidades (solo lectura, todos los roles)
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getAuthenticatedUser } from '@/app/api/_helpers';

// Nunca cachear: cada respuesta depende del usuario autenticado y de datos que cambian por request.
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const { data, error } = await supabaseAdmin
      .from('unidades_medida')
      .select('*')
      .order('nombre');
    if (error) throw error;

    return NextResponse.json({ ok: true, data });
  } catch (e) {
    console.error('[GET /api/unidades-medida]', e);
    return NextResponse.json({ error: 'Error al obtener unidades' }, { status: 500 });
  }
}
