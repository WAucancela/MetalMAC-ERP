/**
 * __tests__/ventas.schema.test.ts
 * Tests de validación Zod para lib/validations/ventas.schema.ts
 */

import {
  FacturaVentaSchema,
  MarcarEmitidaSchema,
  FacturasVentaQuerySchema,
} from '../lib/validations/ventas.schema';
import { calcularDigitoVerificador } from '../lib/services/sri.service';

function buildClaveValida(): string {
  const datos = '0705201701099400874000120010010000000011234567811';
  const digits = datos.slice(0, 48).split('').map(Number);
  const dv = calcularDigitoVerificador(digits);
  return datos.slice(0, 48) + dv;
}

describe('FacturaVentaSchema', () => {
  const base = {
    clienteNombre: 'Municipio de Guayaquil',
    clienteRuc: '0900000000001',
    clienteEmail: 'compras@guayaquil.gob.ec',
    fechaEmision: '2026-08-01',
    lineas: [{ descripcion: 'Reja modelo A', cantidad: 2, precioUnitario: 150 }],
  };

  it('acepta una factura válida y aplica defaults', () => {
    const result = FacturaVentaSchema.parse(base);
    expect(result.proyectoId).toBeNull();
    expect(result.lineas[0].ordenProduccionId).toBeNull();
  });

  it('acepta cédula de 10 dígitos como clienteRuc', () => {
    expect(FacturaVentaSchema.safeParse({ ...base, clienteRuc: '0912345678' }).success).toBe(true);
  });

  it('rechaza clienteRuc con longitud inválida', () => {
    expect(FacturaVentaSchema.safeParse({ ...base, clienteRuc: '123' }).success).toBe(false);
  });

  it('rechaza email inválido', () => {
    expect(FacturaVentaSchema.safeParse({ ...base, clienteEmail: 'no-es-email' }).success).toBe(false);
  });

  it('rechaza una factura sin líneas', () => {
    expect(FacturaVentaSchema.safeParse({ ...base, lineas: [] }).success).toBe(false);
  });

  it('rechaza cantidad <= 0 en una línea', () => {
    const invalid = { ...base, lineas: [{ ...base.lineas[0], cantidad: 0 }] };
    expect(FacturaVentaSchema.safeParse(invalid).success).toBe(false);
  });
});

describe('MarcarEmitidaSchema', () => {
  const claveAcceso = buildClaveValida();

  it('acepta número + clave de acceso válidos', () => {
    expect(MarcarEmitidaSchema.safeParse({ numeroFactura: '001-001-000000123', claveAcceso }).success).toBe(true);
  });

  it('rechaza numeroFactura con formato incorrecto', () => {
    expect(MarcarEmitidaSchema.safeParse({ numeroFactura: '1-1-1', claveAcceso }).success).toBe(false);
  });

  it('rechaza claveAcceso con longitud distinta a 49', () => {
    expect(
      MarcarEmitidaSchema.safeParse({ numeroFactura: '001-001-000000123', claveAcceso: '123' }).success,
    ).toBe(false);
  });

  it('rechaza claveAcceso con dígito verificador incorrecto', () => {
    const corrupta = claveAcceso.slice(0, 48) + ((parseInt(claveAcceso[48]) + 1) % 10).toString();
    expect(
      MarcarEmitidaSchema.safeParse({ numeroFactura: '001-001-000000123', claveAcceso: corrupta }).success,
    ).toBe(false);
  });
});

describe('FacturasVentaQuerySchema', () => {
  it('aplica el límite por defecto de 20', () => {
    expect(FacturasVentaQuerySchema.parse({}).limit).toBe(20);
  });

  it('rechaza un estado inválido', () => {
    expect(FacturasVentaQuerySchema.safeParse({ estado: 'PROCESADA' }).success).toBe(false);
  });
});
