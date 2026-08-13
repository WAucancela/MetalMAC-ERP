/**
 * caja.service.ts — caja chica. Una sola caja implícita (ver migración); saldo
 * calculado al leer, mismo criterio que bancos/facturas.
 */

import { supabaseAdmin } from '@/lib/supabase/admin';
import type { Database } from '@/types/supabase.types';

type CajaMovimientoRow = Database['public']['Tables']['caja_chica_movimientos']['Row'];
type CajaMovimientoUpdate = Database['public']['Tables']['caja_chica_movimientos']['Update'];
type TipoMovimientoCaja = Database['public']['Enums']['tipo_movimiento_caja'];

// ─────────────────────────────────────────────
// Pura — sin I/O
// ─────────────────────────────────────────────

export function calcularSaldoCaja(movimientos: Array<{ tipo: TipoMovimientoCaja; monto: number }>): number {
  const saldo = movimientos.reduce((s, m) => s + (m.tipo === 'INGRESO' ? m.monto : -m.monto), 0);
  return Math.round(saldo * 10_000) / 10_000;
}

// ─────────────────────────────────────────────
// I/O
// ─────────────────────────────────────────────

export async function listarMovimientosCaja(params?: { desde?: string; hasta?: string }): Promise<CajaMovimientoRow[]> {
  let query = supabaseAdmin.from('caja_chica_movimientos').select('*').order('fecha', { ascending: false });
  if (params?.desde) query = query.gte('fecha', params.desde);
  if (params?.hasta) query = query.lte('fecha', params.hasta);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function crearMovimientoCaja(input: {
  tipo: TipoMovimientoCaja;
  monto: number;
  fecha: string;
  concepto: string;
  centroCostoId?: string | null;
  usuarioId: string;
}): Promise<CajaMovimientoRow> {
  const { data, error } = await supabaseAdmin
    .from('caja_chica_movimientos')
    .insert({
      tipo: input.tipo,
      monto: input.monto,
      fecha: input.fecha,
      concepto: input.concepto,
      centro_costo_id: input.centroCostoId ?? null,
      creado_por: input.usuarioId,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Corrige un movimiento existente (typo en el concepto, monto o fecha mal tipeados). */
export async function actualizarMovimientoCaja(
  id: string,
  input: {
    tipo?: TipoMovimientoCaja;
    monto?: number;
    fecha?: string;
    concepto?: string;
    centroCostoId?: string | null;
  },
): Promise<CajaMovimientoRow | null> {
  const update: CajaMovimientoUpdate = {};
  if (input.tipo !== undefined) update.tipo = input.tipo;
  if (input.monto !== undefined) update.monto = input.monto;
  if (input.fecha !== undefined) update.fecha = input.fecha;
  if (input.concepto !== undefined) update.concepto = input.concepto;
  if (input.centroCostoId !== undefined) update.centro_costo_id = input.centroCostoId;

  const { data, error } = await supabaseAdmin
    .from('caja_chica_movimientos')
    .update(update)
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Elimina un movimiento cargado por error. Devuelve false si el id no existía. */
export async function eliminarMovimientoCaja(id: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('caja_chica_movimientos')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  return !!data;
}
