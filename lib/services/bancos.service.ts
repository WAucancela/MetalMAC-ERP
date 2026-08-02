/**
 * bancos.service.ts — cuentas bancarias y sus movimientos. El saldo se calcula
 * al leer (nunca denormalizado), mismo criterio que el saldo de facturas en
 * finanzas.service.ts.
 */

import { supabaseAdmin } from '@/lib/supabase/admin';
import type { Database } from '@/types/supabase.types';

type CuentaBancariaRow = Database['public']['Tables']['cuentas_bancarias']['Row'];
type CuentaBancariaInsert = Database['public']['Tables']['cuentas_bancarias']['Insert'];
type MovimientoBancarioRow = Database['public']['Tables']['movimientos_bancarios']['Row'];
type TipoMovimientoBancario = Database['public']['Enums']['tipo_movimiento_bancario'];

// ─────────────────────────────────────────────
// Puras — sin I/O
// ─────────────────────────────────────────────

const TIPOS_INGRESO: readonly TipoMovimientoBancario[] = ['DEPOSITO', 'COBRO_CLIENTE'];

export function calcularSaldoCuenta(
  saldoInicial: number,
  movimientos: Array<{ tipo: TipoMovimientoBancario; monto: number }>,
): number {
  const delta = movimientos.reduce((s, m) => {
    const signo = TIPOS_INGRESO.includes(m.tipo) ? 1 : -1;
    return s + signo * m.monto;
  }, 0);
  return Math.round((saldoInicial + delta) * 10_000) / 10_000;
}

// ─────────────────────────────────────────────
// I/O
// ─────────────────────────────────────────────

export async function listarCuentasBancarias(soloActivas = false): Promise<CuentaBancariaRow[]> {
  let query = supabaseAdmin.from('cuentas_bancarias').select('*').order('banco');
  if (soloActivas) query = query.eq('activo', true);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function crearCuentaBancaria(input: Omit<CuentaBancariaInsert, 'id' | 'creado_en'>): Promise<CuentaBancariaRow> {
  const { data, error } = await supabaseAdmin.from('cuentas_bancarias').insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function actualizarCuentaBancaria(
  id: string,
  input: Partial<Omit<CuentaBancariaInsert, 'id' | 'creado_en'>>,
): Promise<CuentaBancariaRow | null> {
  const { data, error } = await supabaseAdmin.from('cuentas_bancarias').update(input).eq('id', id).select().maybeSingle();
  if (error) throw error;
  return data;
}

export async function listarMovimientosBancarios(cuentaBancariaId: string): Promise<MovimientoBancarioRow[]> {
  const { data, error } = await supabaseAdmin
    .from('movimientos_bancarios')
    .select('*')
    .eq('cuenta_bancaria_id', cuentaBancariaId)
    .order('fecha', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function crearMovimientoBancario(input: {
  cuentaBancariaId: string;
  tipo: TipoMovimientoBancario;
  monto: number;
  fecha: string;
  descripcion?: string;
  usuarioId: string;
}): Promise<MovimientoBancarioRow> {
  const { data, error } = await supabaseAdmin
    .from('movimientos_bancarios')
    .insert({
      cuenta_bancaria_id: input.cuentaBancariaId,
      tipo: input.tipo,
      monto: input.monto,
      fecha: input.fecha,
      descripcion: input.descripcion ?? '',
      creado_por: input.usuarioId,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function marcarConciliado(movimientoId: string, conciliado: boolean): Promise<void> {
  const { error } = await supabaseAdmin
    .from('movimientos_bancarios')
    .update({ conciliado })
    .eq('id', movimientoId);
  if (error) throw error;
}
