/**
 * finanzas.service.ts — cuentas por cobrar/pagar: saldo pendiente, antigüedad
 * de cartera, y registro de pagos/cobros (vía los RPC `registrar_pago_compra`/
 * `registrar_cobro_venta`, que dejan el pago/cobro y su movimiento bancario
 * asociado — si corresponde — atómicos).
 */

import { supabaseAdmin } from '@/lib/supabase/admin';
import type { Database } from '@/types/supabase.types';

type PagoCompraRow = Database['public']['Tables']['pagos_factura_compra']['Row'];
type CobroVentaRow = Database['public']['Tables']['cobros_factura_venta']['Row'];

// ─────────────────────────────────────────────
// Puras — sin I/O
// ─────────────────────────────────────────────

/** Redondeo a 4 decimales, mismo criterio que las columnas numeric(14,4). */
function redondear4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

export function calcularSaldoFactura(total: number, pagos: number[]): number {
  const suma = pagos.reduce((s, p) => s + p, 0);
  return redondear4(total - suma);
}

export type BucketAntiguedad =
  | 'SIN_VENCIMIENTO'  // la factura no tiene fecha_vencimiento cargada
  | 'VIGENTE'          // todavía no vence
  | 'VENCIDO_0_30'
  | 'VENCIDO_31_60'
  | 'VENCIDO_61_90'
  | 'VENCIDO_90_MAS';

/** `hoy` es parámetro (no `new Date()` interno) para que la función sea pura y testeable. */
export function calcularAntiguedad(fechaVencimiento: string | null, hoy: Date): BucketAntiguedad {
  if (!fechaVencimiento) return 'SIN_VENCIMIENTO';

  const vencimiento = new Date(fechaVencimiento + 'T00:00:00');
  const diasVencido = Math.floor((hoy.getTime() - vencimiento.getTime()) / (1000 * 60 * 60 * 24));

  if (diasVencido < 0) return 'VIGENTE';
  if (diasVencido <= 30) return 'VENCIDO_0_30';
  if (diasVencido <= 60) return 'VENCIDO_31_60';
  if (diasVencido <= 90) return 'VENCIDO_61_90';
  return 'VENCIDO_90_MAS';
}

// ─────────────────────────────────────────────
// I/O
// ─────────────────────────────────────────────

/** El monto ingresado supera el saldo pendiente de la factura — error de entrada del usuario. */
export class SaldoInsuficienteError extends Error {
  constructor(public readonly saldo: number, public readonly monto: number) {
    super(`El monto (${monto}) supera el saldo pendiente (${saldo})`);
    this.name = 'SaldoInsuficienteError';
  }
}

export class FacturaNoEncontradaError extends Error {
  constructor() {
    super('Factura no encontrada');
    this.name = 'FacturaNoEncontradaError';
  }
}

function traducirErrorRpc(error: { message: string; details?: string | null }): never {
  const detail = error.details ? JSON.parse(error.details) : {};
  if (error.message.startsWith('SALDO_INSUFICIENTE')) {
    throw new SaldoInsuficienteError(detail.saldo, detail.monto);
  }
  if (error.message.startsWith('FACTURA_NO_ENCONTRADA')) {
    throw new FacturaNoEncontradaError();
  }
  throw new Error(error.message);
}

export interface RegistrarPagoInput {
  monto: number;
  fecha: string;
  metodoPago?: string;
  referencia?: string;
  cuentaBancariaId?: string | null;
  notas?: string;
}

export async function registrarPagoCompra(
  facturaCompraId: string,
  input: RegistrarPagoInput,
  usuarioId: string,
): Promise<PagoCompraRow> {
  const { data, error } = await supabaseAdmin.rpc('registrar_pago_compra', {
    p_factura_compra_id: facturaCompraId,
    p_monto: input.monto,
    p_fecha: input.fecha,
    p_metodo_pago: input.metodoPago ?? '',
    p_referencia: input.referencia ?? '',
    // `supabase gen types` no marca este arg como nullable aunque el parámetro
    // Postgres (uuid, sin default) sí acepta NULL — mismo cast documentado que
    // ya usa crear_orden_produccion en app/api/ordenes-produccion/route.ts.
    p_cuenta_bancaria_id: (input.cuentaBancariaId ?? null) as string,
    p_notas: input.notas ?? '',
    p_usuario_id: usuarioId,
  });
  if (error) traducirErrorRpc(error);
  return data as PagoCompraRow;
}

export async function registrarCobroVenta(
  facturaVentaId: string,
  input: RegistrarPagoInput,
  usuarioId: string,
): Promise<CobroVentaRow> {
  const { data, error } = await supabaseAdmin.rpc('registrar_cobro_venta', {
    p_factura_venta_id: facturaVentaId,
    p_monto: input.monto,
    p_fecha: input.fecha,
    p_metodo_pago: input.metodoPago ?? '',
    p_referencia: input.referencia ?? '',
    p_cuenta_bancaria_id: (input.cuentaBancariaId ?? null) as string,
    p_notas: input.notas ?? '',
    p_usuario_id: usuarioId,
  });
  if (error) traducirErrorRpc(error);
  return data as CobroVentaRow;
}

export async function listarPagosCompra(facturaCompraId: string): Promise<PagoCompraRow[]> {
  const { data, error } = await supabaseAdmin
    .from('pagos_factura_compra')
    .select('*')
    .eq('factura_compra_id', facturaCompraId)
    .order('fecha', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listarCobrosVenta(facturaVentaId: string): Promise<CobroVentaRow[]> {
  const { data, error } = await supabaseAdmin
    .from('cobros_factura_venta')
    .select('*')
    .eq('factura_venta_id', facturaVentaId)
    .order('fecha', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
