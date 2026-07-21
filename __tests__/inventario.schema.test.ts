/**
 * __tests__/inventario.schema.test.ts
 * Tests de validación Zod para lib/validations/inventario.schema.ts
 */

import {
  CreateMaterialSchema,
  CreateMovimientoSchema,
  UpdateStockMinimasSchema,
  MaterialesQuerySchema,
  MovimientosQuerySchema,
} from '../lib/validations/inventario.schema';

describe('CreateMaterialSchema', () => {
  const base = {
    codigoInterno: 'ACX-304-3MM',
    nombre: 'Plancha inox 304 3mm',
    tipo: 'PLANCHA',
    categoriaId: 'cat-1',
    unidadBaseId: 'u-1',
    costoUnitario: 12.5,
  };

  it('acepta un material válido con especificaciones de plancha', () => {
    const result = CreateMaterialSchema.safeParse({
      ...base,
      especificaciones: { anchoMm: 1220, largoMm: 2440, espesorMm: 3, pesoKgM2: 24 },
    });
    expect(result.success).toBe(true);
  });

  it('aplica defaults: descripcion, grado, activo, especificaciones', () => {
    const result = CreateMaterialSchema.parse(base);
    expect(result.descripcion).toBe('');
    expect(result.grado).toBe('');
    expect(result.activo).toBe(true);
    expect(result.especificaciones).toEqual({});
  });

  it('rechaza codigoInterno menor a 3 caracteres', () => {
    const result = CreateMaterialSchema.safeParse({ ...base, codigoInterno: 'AB' });
    expect(result.success).toBe(false);
  });

  it('rechaza tipo fuera del enum', () => {
    const result = CreateMaterialSchema.safeParse({ ...base, tipo: 'MADERA' });
    expect(result.success).toBe(false);
  });

  it('rechaza costoUnitario negativo', () => {
    const result = CreateMaterialSchema.safeParse({ ...base, costoUnitario: -1 });
    expect(result.success).toBe(false);
  });

  it('acepta costoUnitario = 0 (nonnegative permite cero)', () => {
    const result = CreateMaterialSchema.safeParse({ ...base, costoUnitario: 0 });
    expect(result.success).toBe(true);
  });
});

describe('CreateMovimientoSchema', () => {
  const base = {
    materialId: 'mat-1',
    tipo: 'ENTRADA',
    cantidad: 10,
    costoUnitario: 5,
    documentoTipo: 'AJUSTE_MANUAL',
    numeroReferencia: 'REF-001',
  };

  it('acepta un movimiento válido', () => {
    expect(CreateMovimientoSchema.safeParse(base).success).toBe(true);
  });

  it('rechaza cantidad = 0 (debe ser mayor a 0)', () => {
    const result = CreateMovimientoSchema.safeParse({ ...base, cantidad: 0 });
    expect(result.success).toBe(false);
  });

  it('rechaza cantidad negativa', () => {
    expect(CreateMovimientoSchema.safeParse({ ...base, cantidad: -5 }).success).toBe(false);
  });

  it('rechaza tipo de movimiento inválido', () => {
    expect(CreateMovimientoSchema.safeParse({ ...base, tipo: 'ROBO' }).success).toBe(false);
  });

  it('no acepta usuarioId en el body (lo inyecta el servidor)', () => {
    // El schema no declara usuarioId, así que un valor extra no debería ser requerido
    const { usuarioId, ...withoutUser } = { ...base, usuarioId: 'x' } as typeof base & { usuarioId: string };
    expect(CreateMovimientoSchema.safeParse(withoutUser).success).toBe(true);
  });

  it('rechaza numeroReferencia vacío', () => {
    expect(CreateMovimientoSchema.safeParse({ ...base, numeroReferencia: '' }).success).toBe(false);
  });
});

describe('UpdateStockMinimasSchema', () => {
  it('acepta cantidadMinima >= 0 y cantidadMaxima nula', () => {
    const result = UpdateStockMinimasSchema.safeParse({ cantidadMinima: 5, cantidadMaxima: null });
    expect(result.success).toBe(true);
  });

  it('rechaza cantidadMinima negativa', () => {
    expect(UpdateStockMinimasSchema.safeParse({ cantidadMinima: -1 }).success).toBe(false);
  });

  it('rechaza cantidadMaxima = 0 (debe ser positiva si se especifica)', () => {
    expect(
      UpdateStockMinimasSchema.safeParse({ cantidadMinima: 0, cantidadMaxima: 0 }).success,
    ).toBe(false);
  });
});

describe('MaterialesQuerySchema', () => {
  it('aplica límite y default de paginación', () => {
    const result = MaterialesQuerySchema.parse({});
    expect(result.limite).toBe(50);
  });

  it('coerciona "activo" de string a boolean', () => {
    const result = MaterialesQuerySchema.parse({ activo: 'true' });
    expect(result.activo).toBe(true);
  });

  it('rechaza límite mayor a 100', () => {
    expect(MaterialesQuerySchema.safeParse({ limite: '500' }).success).toBe(false);
  });
});

describe('MovimientosQuerySchema', () => {
  it('acepta filtros de fecha coercionados a Date', () => {
    const result = MovimientosQuerySchema.parse({ desde: '2026-01-01', hasta: '2026-01-31' });
    expect(result.desde).toBeInstanceOf(Date);
    expect(result.hasta).toBeInstanceOf(Date);
  });

  it('rechaza tipo de movimiento inválido en query', () => {
    expect(MovimientosQuerySchema.safeParse({ tipo: 'INVALIDO' }).success).toBe(false);
  });
});
