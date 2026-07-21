/**
 * POST /api/sri/resolver-equivalencias
 *
 * Recibe las líneas parseadas de una factura XML y las resuelve
 * contra la tabla_equivalencias del proveedor.
 *
 * Body: { proveedorId: string, lineas: LineaXML[] }
 */

import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers';
import { ResolverEquivalenciasSchema } from '@/lib/validations/sri.schema';
import { resolverLineasFactura } from '@/lib/services/equivalencias.service';

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const parsed = ResolverEquivalenciasSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', detalles: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { proveedorId, lineas } = parsed.data;

  try {
    const resultado = await resolverLineasFactura(proveedorId, lineas);
    return NextResponse.json({ ok: true, data: resultado });
  } catch (e) {
    console.error('[/api/sri/resolver-equivalencias]', e);
    return NextResponse.json({ error: 'Error al resolver equivalencias' }, { status: 500 });
  }
}
