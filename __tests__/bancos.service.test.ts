/**
 * __tests__/bancos.service.test.ts
 * Tests de la función pura calcularSaldoCuenta de lib/services/bancos.service.ts.
 */

jest.mock('@/lib/supabase/admin', () => ({ supabaseAdmin: {} }));

import { calcularSaldoCuenta } from '../lib/services/bancos.service';

describe('calcularSaldoCuenta', () => {
  it('devuelve el saldo inicial si no hay movimientos', () => {
    expect(calcularSaldoCuenta(1000, [])).toBe(1000);
  });

  it('suma depósitos y cobros de cliente', () => {
    expect(calcularSaldoCuenta(0, [
      { tipo: 'DEPOSITO', monto: 100 },
      { tipo: 'COBRO_CLIENTE', monto: 50 },
    ])).toBe(150);
  });

  it('resta retiros, pagos a proveedor y ajustes', () => {
    expect(calcularSaldoCuenta(500, [
      { tipo: 'RETIRO', monto: 100 },
      { tipo: 'PAGO_PROVEEDOR', monto: 50 },
      { tipo: 'AJUSTE', monto: 25 },
    ])).toBe(325);
  });

  it('combina saldo inicial, ingresos y egresos', () => {
    expect(calcularSaldoCuenta(1000, [
      { tipo: 'DEPOSITO', monto: 200 },
      { tipo: 'RETIRO', monto: 300 },
    ])).toBe(900);
  });
});
