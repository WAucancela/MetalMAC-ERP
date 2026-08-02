/**
 * __tests__/caja.service.test.ts
 * Tests de la función pura calcularSaldoCaja de lib/services/caja.service.ts.
 */

jest.mock('@/lib/supabase/admin', () => ({ supabaseAdmin: {} }));

import { calcularSaldoCaja } from '../lib/services/caja.service';

describe('calcularSaldoCaja', () => {
  it('devuelve 0 sin movimientos', () => {
    expect(calcularSaldoCaja([])).toBe(0);
  });

  it('suma ingresos y resta egresos', () => {
    expect(calcularSaldoCaja([
      { tipo: 'INGRESO', monto: 200 },
      { tipo: 'EGRESO', monto: 50 },
      { tipo: 'EGRESO', monto: 30 },
    ])).toBe(120);
  });

  it('puede dar saldo negativo si los egresos superan los ingresos (dato inconsistente a corregir a mano)', () => {
    expect(calcularSaldoCaja([
      { tipo: 'INGRESO', monto: 50 },
      { tipo: 'EGRESO', monto: 100 },
    ])).toBe(-50);
  });
});
