/**
 * __tests__/finanzas.service.test.ts
 * Tests de las funciones puras de lib/services/finanzas.service.ts.
 *
 * finanzas.service.ts importa supabaseAdmin, que inicializa el cliente al
 * cargarse (lanza si faltan las variables de entorno) — se mockea antes de
 * importar el servicio, mismo criterio que bom.service.test.ts.
 */

jest.mock('@/lib/supabase/admin', () => ({ supabaseAdmin: {} }));

import { calcularSaldoFactura, calcularAntiguedad } from '../lib/services/finanzas.service';

describe('calcularSaldoFactura', () => {
  it('resta la suma de los pagos del total', () => {
    expect(calcularSaldoFactura(1000, [300, 200])).toBe(500);
  });

  it('devuelve el total completo si no hay pagos', () => {
    expect(calcularSaldoFactura(500, [])).toBe(500);
  });

  it('devuelve 0 si los pagos cubren exactamente el total', () => {
    expect(calcularSaldoFactura(500, [500])).toBe(0);
  });

  it('redondea a 4 decimales', () => {
    expect(calcularSaldoFactura(10.1, [3.05, 3.05])).toBeCloseTo(4, 4);
  });
});

describe('calcularAntiguedad', () => {
  const hoy = new Date('2026-08-15T00:00:00');

  it('devuelve SIN_VENCIMIENTO si no hay fecha de vencimiento', () => {
    expect(calcularAntiguedad(null, hoy)).toBe('SIN_VENCIMIENTO');
  });

  it('devuelve VIGENTE si el vencimiento todavía no llegó', () => {
    expect(calcularAntiguedad('2026-09-01', hoy)).toBe('VIGENTE');
  });

  it('devuelve VIGENTE el mismo día del vencimiento', () => {
    expect(calcularAntiguedad('2026-08-15', hoy)).toBe('VIGENTE');
  });

  it('devuelve VENCIDO_0_30 dentro de los primeros 30 días vencidos', () => {
    expect(calcularAntiguedad('2026-08-01', hoy)).toBe('VENCIDO_0_30'); // 14 días
  });

  it('devuelve VENCIDO_31_60 entre 31 y 60 días vencidos', () => {
    expect(calcularAntiguedad('2026-07-01', hoy)).toBe('VENCIDO_31_60'); // 45 días
  });

  it('devuelve VENCIDO_61_90 entre 61 y 90 días vencidos', () => {
    expect(calcularAntiguedad('2026-06-01', hoy)).toBe('VENCIDO_61_90'); // 75 días
  });

  it('devuelve VENCIDO_90_MAS después de 90 días vencidos', () => {
    expect(calcularAntiguedad('2026-01-01', hoy)).toBe('VENCIDO_90_MAS');
  });
});
