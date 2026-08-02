import { z } from 'zod';

export const CuentaBancariaSchema = z.object({
  banco: z.string().min(2).max(200),
  numeroCuenta: z.string().min(1).max(50),
  tipoCuenta: z.enum(['AHORROS', 'CORRIENTE']),
  saldoInicial: z.number().nonnegative().default(0),
  activo: z.boolean().default(true),
});
export type CuentaBancariaInput = z.infer<typeof CuentaBancariaSchema>;

export const ActualizarCuentaBancariaSchema = CuentaBancariaSchema.partial();
export type ActualizarCuentaBancariaInput = z.infer<typeof ActualizarCuentaBancariaSchema>;

export const MovimientoBancarioSchema = z.object({
  tipo: z.enum(['DEPOSITO', 'RETIRO', 'PAGO_PROVEEDOR', 'COBRO_CLIENTE', 'AJUSTE']),
  monto: z.number().positive('El monto debe ser mayor a 0'),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato ISO: YYYY-MM-DD'),
  descripcion: z.string().max(500).default(''),
});
export type MovimientoBancarioInput = z.infer<typeof MovimientoBancarioSchema>;

export const ConciliarMovimientoSchema = z.object({
  conciliado: z.boolean(),
});
export type ConciliarMovimientoInput = z.infer<typeof ConciliarMovimientoSchema>;
