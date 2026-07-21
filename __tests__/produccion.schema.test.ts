/**
 * __tests__/produccion.schema.test.ts
 * Tests de validación Zod para lib/validations/produccion.schema.ts
 */

import {
  ProductoSchema,
  LineaBOMSchema,
  OperacionBOMSchema,
  BOMSchema,
  CrearOrdenSchema,
  ActualizarEstadoOrdenSchema,
  OrdenesQuerySchema,
} from '../lib/validations/produccion.schema';

describe('ProductoSchema', () => {
  const base = {
    codigo: 'POSTE-8M',
    nombre: 'Poste 8m',
    tipo: 'PRODUCTO_TERMINADO',
    unidadVenta: 'UNIDAD',
    precioVenta: 250,
  };

  it('acepta un producto válido y aplica defaults', () => {
    const result = ProductoSchema.parse(base);
    expect(result.descripcion).toBe('');
    expect(result.activo).toBe(true);
  });

  it('rechaza tipo fuera del enum', () => {
    expect(ProductoSchema.safeParse({ ...base, tipo: 'INSUMO' }).success).toBe(false);
  });

  it('rechaza precioVenta negativo', () => {
    expect(ProductoSchema.safeParse({ ...base, precioVenta: -1 }).success).toBe(false);
  });
});

describe('LineaBOMSchema', () => {
  const base = { materialId: 'mat-1', cantidadBase: 2, factorMerma: 1.1, unidadId: 'u-1' };

  it('acepta una línea válida y default notas', () => {
    const result = LineaBOMSchema.parse(base);
    expect(result.notas).toBe('');
  });

  it('rechaza factorMerma menor a 1 (no puede ahorrar material)', () => {
    expect(LineaBOMSchema.safeParse({ ...base, factorMerma: 0.9 }).success).toBe(false);
  });

  it('rechaza factorMerma mayor a 3', () => {
    expect(LineaBOMSchema.safeParse({ ...base, factorMerma: 3.5 }).success).toBe(false);
  });

  it('acepta factorMerma = 1 (sin merma)', () => {
    expect(LineaBOMSchema.safeParse({ ...base, factorMerma: 1 }).success).toBe(true);
  });

  it('rechaza cantidadBase = 0', () => {
    expect(LineaBOMSchema.safeParse({ ...base, cantidadBase: 0 }).success).toBe(false);
  });
});

describe('OperacionBOMSchema', () => {
  it('acepta una operación válida', () => {
    const result = OperacionBOMSchema.safeParse({ tipo: 'LASER', minutos: 10, costoPorMinuto: 0.75 });
    expect(result.success).toBe(true);
  });

  it('rechaza tipo de operación inválido', () => {
    expect(
      OperacionBOMSchema.safeParse({ tipo: 'PINTURA', minutos: 10, costoPorMinuto: 0.75 }).success,
    ).toBe(false);
  });

  it('rechaza minutos = 0', () => {
    expect(
      OperacionBOMSchema.safeParse({ tipo: 'LASER', minutos: 0, costoPorMinuto: 0.75 }).success,
    ).toBe(false);
  });
});

describe('BOMSchema', () => {
  const linea = { materialId: 'mat-1', cantidadBase: 2, factorMerma: 1.1, unidadId: 'u-1' };

  it('rechaza un BOM sin líneas', () => {
    expect(BOMSchema.safeParse({ lineas: [], operaciones: [] }).success).toBe(false);
  });

  it('acepta un BOM con al menos una línea y default de operaciones', () => {
    const result = BOMSchema.parse({ lineas: [linea] });
    expect(result.operaciones).toEqual([]);
  });
});

describe('CrearOrdenSchema', () => {
  const base = { productoId: 'prod-1', cantidad: 10, fechaEntrega: '2026-08-01' };

  it('acepta una orden válida', () => {
    expect(CrearOrdenSchema.safeParse(base).success).toBe(true);
  });

  it('rechaza cantidad no entera', () => {
    expect(CrearOrdenSchema.safeParse({ ...base, cantidad: 1.5 }).success).toBe(false);
  });

  it('rechaza cantidad <= 0', () => {
    expect(CrearOrdenSchema.safeParse({ ...base, cantidad: 0 }).success).toBe(false);
  });

  it('rechaza formato de fecha inválido', () => {
    expect(CrearOrdenSchema.safeParse({ ...base, fechaEntrega: '01/08/2026' }).success).toBe(false);
  });
});

describe('ActualizarEstadoOrdenSchema', () => {
  it('acepta transición a EN_PROCESO, COMPLETADA o CANCELADA', () => {
    for (const estado of ['EN_PROCESO', 'COMPLETADA', 'CANCELADA']) {
      expect(ActualizarEstadoOrdenSchema.safeParse({ estado }).success).toBe(true);
    }
  });

  it('rechaza BORRADOR como estado destino (no es una transición válida de entrada)', () => {
    expect(ActualizarEstadoOrdenSchema.safeParse({ estado: 'BORRADOR' }).success).toBe(false);
  });
});

describe('OrdenesQuerySchema', () => {
  it('aplica el límite por defecto', () => {
    expect(OrdenesQuerySchema.parse({}).limit).toBe(20);
  });

  it('rechaza un estado inválido', () => {
    expect(OrdenesQuerySchema.safeParse({ estado: 'PAUSADA' }).success).toBe(false);
  });
});
