/**
 * __tests__/proyectos.schema.test.ts
 * Tests de validación Zod para lib/validations/proyectos.schema.ts
 */

import {
  ProyectoSchema,
  ActualizarProyectoSchema,
  GastoSchema,
  ActualizarGastoSchema,
  GastosQuerySchema,
} from '../lib/validations/proyectos.schema';

describe('ProyectoSchema', () => {
  const base = {
    nombre: 'Nave Industrial Empresa X',
    cliente: 'Empresa X',
    presupuesto: 50000,
    fechaInicio: '2026-01-15',
  };

  it('acepta un proyecto válido y aplica defaults', () => {
    const result = ProyectoSchema.parse(base);
    expect(result.estado).toBe('PLANIFICACION');
    expect(result.descripcion).toBe('');
    expect(result.ordenesProduccion).toEqual([]);
  });

  it('rechaza presupuesto <= 0', () => {
    expect(ProyectoSchema.safeParse({ ...base, presupuesto: 0 }).success).toBe(false);
  });

  it('rechaza un estado fuera del enum', () => {
    expect(ProyectoSchema.safeParse({ ...base, estado: 'EN_PAUSA' }).success).toBe(false);
  });

  it('rechaza formato de fechaInicio inválido', () => {
    expect(ProyectoSchema.safeParse({ ...base, fechaInicio: '15-01-2026' }).success).toBe(false);
  });

  it('acepta fechaFin nula', () => {
    expect(ProyectoSchema.safeParse({ ...base, fechaFin: null }).success).toBe(true);
  });
});

describe('ActualizarProyectoSchema', () => {
  it('acepta un update parcial con un solo campo', () => {
    expect(ActualizarProyectoSchema.safeParse({ estado: 'ACTIVO' }).success).toBe(true);
  });

  it('acepta un objeto vacío (todo es opcional en partial)', () => {
    expect(ActualizarProyectoSchema.safeParse({}).success).toBe(true);
  });
});

describe('GastoSchema', () => {
  const base = {
    proyectoId: 'proy-1',
    categoria: 'TRANSPORTE',
    descripcion: 'Flete de materiales a obra',
    monto: 150.5,
    fecha: '2026-02-10',
  };

  it('acepta un gasto válido', () => {
    expect(GastoSchema.safeParse(base).success).toBe(true);
  });

  it('rechaza monto <= 0', () => {
    expect(GastoSchema.safeParse({ ...base, monto: 0 }).success).toBe(false);
  });

  it('rechaza categoria fuera del enum', () => {
    expect(GastoSchema.safeParse({ ...base, categoria: 'COMBUSTIBLE' }).success).toBe(false);
  });

  it('rechaza comprobante que no sea URL', () => {
    expect(GastoSchema.safeParse({ ...base, comprobante: 'no-es-url' }).success).toBe(false);
  });

  it('acepta comprobante null', () => {
    expect(GastoSchema.safeParse({ ...base, comprobante: null }).success).toBe(true);
  });
});

describe('ActualizarGastoSchema', () => {
  it('no permite actualizar proyectoId (omitido del schema)', () => {
    const result = ActualizarGastoSchema.safeParse({ proyectoId: 'otro-proyecto', monto: 10 });
    // proyectoId no está definido en el schema; con .omit() Zod lo ignora (strip por defecto)
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).proyectoId).toBeUndefined();
    }
  });
});

describe('GastosQuerySchema', () => {
  it('aplica el límite por defecto de 100', () => {
    expect(GastosQuerySchema.parse({}).limit).toBe(100);
  });

  it('rechaza categoria inválida en el query', () => {
    expect(GastosQuerySchema.safeParse({ categoria: 'VIATICOS' }).success).toBe(false);
  });
});
