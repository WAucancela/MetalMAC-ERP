/**
 * GET /api/inventario/stock           → stock de todos los materiales
 * GET /api/inventario/stock?alertas=1 → solo los que están bajo mínimo
 */
import { NextRequest } from 'next/server';
import { obtenerAlertasStockBajo } from '@/lib/services/inventario.service';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  ok, unauthorized, internalError, getAuthenticatedUser,
} from '@/app/api/_helpers';
import { mapStockRow } from '@/lib/services/mappers';

// Nunca cachear: cada respuesta depende del usuario autenticado y de datos que cambian por request.
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorized();

  const soloAlertas =
    request.nextUrl.searchParams.get('alertas') === '1';

  try {
    if (soloAlertas) {
      const alertas = await obtenerAlertasStockBajo();
      return ok(alertas);
    }

    const { data, error } = await supabaseAdmin.from('stock').select('*');
    if (error) throw error;

    return ok((data ?? []).map(mapStockRow));
  } catch (err) {
    console.error('[GET /stock]', err);
    return internalError();
  }
}
