/**
 * GET  /api/bancos/cuentas  — lista cuentas bancarias con saldo calculado
 * POST /api/bancos/cuentas  — crea una cuenta bancaria
 */

import { NextResponse } from 'next/server';
import { getAuthenticatedUser, puedeGestionarFinanzas } from '@/app/api/_helpers';
import { CuentaBancariaSchema } from '@/lib/validations/bancos.schema';
import {
  listarCuentasBancarias, crearCuentaBancaria, listarMovimientosBancarios, calcularSaldoCuenta,
} from '@/lib/services/bancos.service';
import { mapCuentaBancariaRow } from '@/lib/services/mappers';

// Nunca cachear: cada respuesta depende del usuario autenticado y de datos que cambian por request.
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const cuentas = await listarCuentasBancarias();
    const conSaldo = await Promise.all(
      cuentas.map(async (c) => {
        const movimientos = await listarMovimientosBancarios(c.id);
        return {
          ...mapCuentaBancariaRow(c),
          saldo: calcularSaldoCuenta(Number(c.saldo_inicial), movimientos.map((m) => ({ tipo: m.tipo, monto: Number(m.monto) }))),
        };
      }),
    );
    return NextResponse.json({ ok: true, data: conSaldo });
  } catch (e) {
    console.error('[GET /api/bancos/cuentas]', e);
    return NextResponse.json({ error: 'Error al obtener cuentas bancarias' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user)                         return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!puedeGestionarFinanzas(user)) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const parsed = CuentaBancariaSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 });

  try {
    const cuenta = await crearCuentaBancaria({
      banco: parsed.data.banco,
      numero_cuenta: parsed.data.numeroCuenta,
      tipo_cuenta: parsed.data.tipoCuenta,
      saldo_inicial: parsed.data.saldoInicial,
      activo: parsed.data.activo,
    });
    return NextResponse.json({ ok: true, data: mapCuentaBancariaRow(cuenta) }, { status: 201 });
  } catch (e) {
    console.error('[POST /api/bancos/cuentas]', e);
    return NextResponse.json({ error: 'Error al crear la cuenta bancaria' }, { status: 500 });
  }
}
