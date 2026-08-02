/**
 * PATCH /api/bancos/cuentas/[id]  — editar datos de la cuenta / activar-desactivar
 */

import { NextResponse } from 'next/server';
import { getAuthenticatedUser, puedeGestionarFinanzas } from '@/app/api/_helpers';
import { ActualizarCuentaBancariaSchema } from '@/lib/validations/bancos.schema';
import { actualizarCuentaBancaria } from '@/lib/services/bancos.service';
import { mapCuentaBancariaRow } from '@/lib/services/mappers';

// Nunca cachear: cada respuesta depende del usuario autenticado y de datos que cambian por request.
export const dynamic = 'force-dynamic';

interface RouteParams { params: { id: string } }

export async function PATCH(request: Request, { params }: RouteParams) {
  const user = await getAuthenticatedUser(request);
  if (!user)                         return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!puedeGestionarFinanzas(user)) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const parsed = ActualizarCuentaBancariaSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 });

  try {
    const update: Record<string, unknown> = {};
    if (parsed.data.banco !== undefined)         update.banco = parsed.data.banco;
    if (parsed.data.numeroCuenta !== undefined)  update.numero_cuenta = parsed.data.numeroCuenta;
    if (parsed.data.tipoCuenta !== undefined)    update.tipo_cuenta = parsed.data.tipoCuenta;
    if (parsed.data.saldoInicial !== undefined)  update.saldo_inicial = parsed.data.saldoInicial;
    if (parsed.data.activo !== undefined)        update.activo = parsed.data.activo;

    const cuenta = await actualizarCuentaBancaria(params.id, update);
    if (!cuenta) return NextResponse.json({ error: 'Cuenta bancaria no encontrada' }, { status: 404 });

    return NextResponse.json({ ok: true, data: mapCuentaBancariaRow(cuenta) });
  } catch (e) {
    console.error(`[PATCH /api/bancos/cuentas/${params.id}]`, e);
    return NextResponse.json({ error: 'Error al actualizar la cuenta bancaria' }, { status: 500 });
  }
}
