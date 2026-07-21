/**
 * GET /api/inventario/stock           → stock de todos los materiales
 * GET /api/inventario/stock?alertas=1 → solo los que están bajo mínimo
 */
import { NextRequest } from 'next/server';
import { obtenerAlertasStockBajo } from '@/lib/services/inventario.service';
import { adminDb } from '@/lib/firebase-admin';
import {
  ok, unauthorized, internalError, getAuthenticatedUser,
} from '@/app/api/_helpers';
import type { Stock } from '@/types/metalmac.types';

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

    const snap = await adminDb.collection('stock').get();
    const stock = snap.docs.map((d) => ({
      materialId: d.id,
      ...(d.data() as Omit<Stock, 'materialId'>),
    }));
    return ok(stock);
  } catch (err) {
    console.error('[GET /stock]', err);
    return internalError();
  }
}
