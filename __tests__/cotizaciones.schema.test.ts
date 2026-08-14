/**
 * __tests__/cotizaciones.schema.test.ts
 * Tests de validación Zod para lib/validations/cotizaciones.schema.ts
 */

import {
  CotizacionSchema,
  ActualizarCotizacionSchema,
  CambiarEstadoCotizacionSchema,
  CotizacionesQuerySchema,
} from '../lib/validations/cotizaciones.schema';

describe('CotizacionSchema', () => {
  const base = {
    clienteNombre: 'Constructora XYZ S.A.',
    clienteEmail: 'compras@xyz.com',
    fechaEmision: '2026-08-13',
    fechaVencimiento: '2026-08-28',
    lineas: [{ descripcion: 'Poste 8m galvanizado', cantidad: 10, precioUnitario: 85.5 }],
  };

  it('acepta una cotización válida y aplica defaults', () => {
    const result = CotizacionSchema.parse(base);
    expect(result.proyectoId).toBeNull();
    expect(result.clienteWhatsapp).toBe('');
    expect(result.notas).toBe('');
    expect(result.lineas[0].productoId).toBeNull();
    expect(result.lineas[0].materialId).toBeNull();
  });

  it('acepta clienteEmail vacío (se completa antes de enviar, no antes de guardar borrador)', () => {
    expect(CotizacionSchema.safeParse({ ...base, clienteEmail: '' }).success).toBe(true);
  });

  it('rechaza clienteEmail inválido si no está vacío', () => {
    expect(CotizacionSchema.safeParse({ ...base, clienteEmail: 'no-es-email' }).success).toBe(false);
  });

  it('rechaza una cotización sin líneas', () => {
    expect(CotizacionSchema.safeParse({ ...base, lineas: [] }).success).toBe(false);
  });

  it('rechaza cantidad <= 0 en una línea', () => {
    const invalid = { ...base, lineas: [{ ...base.lineas[0], cantidad: 0 }] };
    expect(CotizacionSchema.safeParse(invalid).success).toBe(false);
  });

  it('rechaza precioUnitario negativo', () => {
    const invalid = { ...base, lineas: [{ ...base.lineas[0], precioUnitario: -1 }] };
    expect(CotizacionSchema.safeParse(invalid).success).toBe(false);
  });

  it('rechaza fechaEmision con formato inválido', () => {
    expect(CotizacionSchema.safeParse({ ...base, fechaEmision: '13/08/2026' }).success).toBe(false);
  });
});

describe('ActualizarCotizacionSchema', () => {
  it('acepta un objeto vacío (todos los campos opcionales)', () => {
    expect(ActualizarCotizacionSchema.safeParse({}).success).toBe(true);
  });

  it('acepta actualizar solo el campo notas', () => {
    expect(ActualizarCotizacionSchema.safeParse({ notas: 'Precio válido por 15 días' }).success).toBe(true);
  });
});

describe('CambiarEstadoCotizacionSchema', () => {
  it('acepta APROBADA y RECHAZADA', () => {
    expect(CambiarEstadoCotizacionSchema.safeParse({ estado: 'APROBADA' }).success).toBe(true);
    expect(CambiarEstadoCotizacionSchema.safeParse({ estado: 'RECHAZADA' }).success).toBe(true);
  });

  it('rechaza BORRADOR (no es una transición válida vía este endpoint)', () => {
    expect(CambiarEstadoCotizacionSchema.safeParse({ estado: 'BORRADOR' }).success).toBe(false);
  });
});

describe('CotizacionesQuerySchema', () => {
  it('aplica el límite por defecto de 50', () => {
    expect(CotizacionesQuerySchema.parse({}).limit).toBe(50);
  });

  it('rechaza un estado inválido', () => {
    expect(CotizacionesQuerySchema.safeParse({ estado: 'PROCESADA' }).success).toBe(false);
  });
});
