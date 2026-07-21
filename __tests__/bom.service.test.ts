/**
 * __tests__/bom.service.test.ts
 *
 * Tests unitarios para las funciones puras de bom.service.ts.
 * No requieren IO — usan datos inline.
 *
 * Funciones cubiertas:
 * - calcularCantidadConMerma
 * - calcularCostoBOM
 * - validarDisponibilidadBOM
 *
 * bom.service.ts importa supabaseAdmin de lib/supabase/admin.ts, que inicializa
 * el cliente al cargarse (lanza si faltan las variables de entorno) — se mockea
 * antes de importar el servicio aunque estos tests no hagan IO.
 */

jest.mock('@/lib/supabase/admin', () => ({ supabaseAdmin: {} }));

import {
  calcularCantidadConMerma,
  calcularCostoBOM,
  validarDisponibilidadBOM,
} from '../lib/services/bom.service';

// ─────────────────────────────────────────────
// Fixtures compartidos
// ─────────────────────────────────────────────

const BOM_SIMPLE = {
  lineas: [
    { materialId: 'mat-A', cantidadBase: 2,   factorMerma: 1.1, cantidadConMerma: 2.2, unidadId: 'u1', notas: '' },
    { materialId: 'mat-B', cantidadBase: 0.5, factorMerma: 1.0, cantidadConMerma: 0.5, unidadId: 'u2', notas: '' },
  ],
  operaciones: [
    { tipo: 'LASER' as const, minutos: 10, costoPorMinuto: 0.5, costoTotal: 5 },
  ],
};

const MATERIALES_MAP = {
  'mat-A': { nombre: 'Acero inox A', costoUnitario: 4.00 },
  'mat-B': { nombre: 'Pintura gris B', costoUnitario: 8.00 },
};

const STOCK_MAP_OK = {
  'mat-A': { cantidadDisponible: 100 },
  'mat-B': { cantidadDisponible: 50  },
};

const STOCK_MAP_FALTANTE = {
  'mat-A': { cantidadDisponible: 3 },  // requerido = 2 * 1.1 * 2 = 4.4 → falta
  'mat-B': { cantidadDisponible: 50 },
};

// ─────────────────────────────────────────────
// calcularCantidadConMerma
// ─────────────────────────────────────────────

describe('calcularCantidadConMerma', () => {
  it('sin merma (factor = 1), retorna cantidadBase × unidades', () => {
    expect(calcularCantidadConMerma(5, 1, 3)).toBe(15);
  });

  it('con merma, aplica factor correctamente', () => {
    // 2 * 1.1 * 1 = 2.2
    expect(calcularCantidadConMerma(2, 1.1, 1)).toBeCloseTo(2.2, 5);
  });

  it('redondea a 6 decimales (sin errores de punto flotante)', () => {
    // 0.1 + 0.2 => problema en JS nativo
    const result = calcularCantidadConMerma(0.1, 1.0, 3);
    expect(result).toBeCloseTo(0.3, 6);
  });

  it('cantidadBase fraccionaria × merma × múltiples unidades', () => {
    // 0.5 * 1.25 * 4 = 2.5
    expect(calcularCantidadConMerma(0.5, 1.25, 4)).toBeCloseTo(2.5, 5);
  });
});

// ─────────────────────────────────────────────
// calcularCostoBOM
// ─────────────────────────────────────────────

describe('calcularCostoBOM', () => {
  it('lanza RangeError si unidades <= 0', () => {
    expect(() => calcularCostoBOM(BOM_SIMPLE, MATERIALES_MAP, 0)).toThrow(RangeError);
    expect(() => calcularCostoBOM(BOM_SIMPLE, MATERIALES_MAP, -1)).toThrow(RangeError);
  });

  it('calcula correctamente el costo de materiales para 1 unidad', () => {
    // mat-A: 2 * 1.1 * 1 * $4.00 = $8.80
    // mat-B: 0.5 * 1.0 * 1 * $8.00 = $4.00
    // total materiales = $12.80
    const result = calcularCostoBOM(BOM_SIMPLE, MATERIALES_MAP, 1);
    expect(result.costoMateriales).toBeCloseTo(12.8, 4);
  });

  it('calcula correctamente el costo de operaciones para 1 unidad', () => {
    // LASER: 10 min * $0.50/min * 1 = $5.00
    const result = calcularCostoBOM(BOM_SIMPLE, MATERIALES_MAP, 1);
    expect(result.costoOperaciones).toBeCloseTo(5.0, 4);
  });

  it('costoTotal = costoMateriales + costoOperaciones', () => {
    const result = calcularCostoBOM(BOM_SIMPLE, MATERIALES_MAP, 1);
    expect(result.costoTotal).toBeCloseTo(result.costoMateriales + result.costoOperaciones, 4);
  });

  it('escala linealmente con el número de unidades', () => {
    const r1 = calcularCostoBOM(BOM_SIMPLE, MATERIALES_MAP, 1);
    const r5 = calcularCostoBOM(BOM_SIMPLE, MATERIALES_MAP, 5);
    // El costo total de 5 unidades debe ser ~5× el de 1 unidad
    expect(r5.costoTotal).toBeCloseTo(r1.costoTotal * 5, 2);
  });

  it('usa nombre de material del mapa (no [materialId])', () => {
    const result = calcularCostoBOM(BOM_SIMPLE, MATERIALES_MAP, 1);
    expect(result.lineas[0].nombreMaterial).toBe('Acero inox A');
    expect(result.lineas[1].nombreMaterial).toBe('Pintura gris B');
  });

  it('usa "[materialId]" cuando el material no está en el mapa', () => {
    const result = calcularCostoBOM(BOM_SIMPLE, {}, 1);
    expect(result.lineas[0].nombreMaterial).toBe('[mat-A]');
  });

  it('costo 0 para material no encontrado en el mapa', () => {
    const result = calcularCostoBOM(BOM_SIMPLE, {}, 1);
    expect(result.costoMateriales).toBe(0);
  });

  it('BOM sin operaciones tiene costoOperaciones = 0', () => {
    const bomSinOps = { ...BOM_SIMPLE, operaciones: [] };
    const result = calcularCostoBOM(bomSinOps, MATERIALES_MAP, 1);
    expect(result.costoOperaciones).toBe(0);
  });

  it('retorna el número correcto de líneas', () => {
    const result = calcularCostoBOM(BOM_SIMPLE, MATERIALES_MAP, 3);
    expect(result.lineas).toHaveLength(2);
    expect(result.unidades).toBe(3);
  });

  it('cantidadConMerma por línea es cantidadBase × factorMerma × unidades', () => {
    const result = calcularCostoBOM(BOM_SIMPLE, MATERIALES_MAP, 3);
    // mat-A: 2 * 1.1 * 3 = 6.6
    expect(result.lineas[0].cantidadConMerma).toBeCloseTo(6.6, 4);
    // mat-B: 0.5 * 1.0 * 3 = 1.5
    expect(result.lineas[1].cantidadConMerma).toBeCloseTo(1.5, 4);
  });
});

// ─────────────────────────────────────────────
// validarDisponibilidadBOM
// ─────────────────────────────────────────────

describe('validarDisponibilidadBOM', () => {
  it('retorna valido=true cuando hay stock suficiente', () => {
    const result = validarDisponibilidadBOM(BOM_SIMPLE, STOCK_MAP_OK, 2);
    expect(result.valido).toBe(true);
    expect(result.faltantes).toHaveLength(0);
  });

  it('retorna valido=false cuando un material no tiene stock suficiente', () => {
    // mat-A requerido = 2 * 1.1 * 2 = 4.4, disponible = 3 → falta 1.4
    const result = validarDisponibilidadBOM(BOM_SIMPLE, STOCK_MAP_FALTANTE, 2);
    expect(result.valido).toBe(false);
    expect(result.faltantes).toHaveLength(1);
    expect(result.faltantes[0].materialId).toBe('mat-A');
  });

  it('calcula el deficit correcto', () => {
    const result = validarDisponibilidadBOM(BOM_SIMPLE, STOCK_MAP_FALTANTE, 2);
    const faltante = result.faltantes[0];
    // requerido = 4.4, disponible = 3 → deficit = 1.4
    expect(faltante.requerido).toBeCloseTo(4.4, 4);
    expect(faltante.disponible).toBe(3);
    expect(faltante.deficit).toBeCloseTo(1.4, 4);
  });

  it('trata material sin stock como disponible = 0', () => {
    // mat-A sin stock en mapa
    const result = validarDisponibilidadBOM(BOM_SIMPLE, {}, 1);
    expect(result.valido).toBe(false);
    expect(result.faltantes).toHaveLength(2); // ambos materiales faltan
    expect(result.faltantes[0].disponible).toBe(0);
  });

  it('detecta múltiples materiales faltantes simultáneamente', () => {
    const stockTodo0 = {
      'mat-A': { cantidadDisponible: 0 },
      'mat-B': { cantidadDisponible: 0 },
    };
    const result = validarDisponibilidadBOM(BOM_SIMPLE, stockTodo0, 1);
    expect(result.valido).toBe(false);
    expect(result.faltantes).toHaveLength(2);
  });

  it('valido=true cuando stock exacto al requerido', () => {
    // mat-A: 2 * 1.1 * 1 = 2.2 exacto
    const stockExacto = {
      'mat-A': { cantidadDisponible: 2.2 },
      'mat-B': { cantidadDisponible: 0.5 },
    };
    const result = validarDisponibilidadBOM(BOM_SIMPLE, stockExacto, 1);
    expect(result.valido).toBe(true);
  });
});
