/**
 * Tests de la máquina de estados de Órdenes de Producción.
 * Cubre funciones puras de bom.service.ts (sin IO) y la lógica de stock.
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
  StockInsuficienteParaOPError,
} from '../lib/services/bom.service';

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const BOM = {
  lineas: [
    { materialId: 'mat-acero',   cantidadBase: 10,  factorMerma: 1.1, cantidadConMerma: 11,  unidadId: 'kg', notas: '' },
    { materialId: 'mat-pintura', cantidadBase: 0.5, factorMerma: 1.0, cantidadConMerma: 0.5, unidadId: 'lt', notas: '' },
  ],
  operaciones: [
    { tipo: 'SOLDADURA' as const, minutos: 20, costoPorMinuto: 0.75, costoTotal: 15 },
  ],
};

const MATERIALES_MAP = {
  'mat-acero':   { nombre: 'Acero 304',              costoUnitario: 5.00 },
  'mat-pintura': { nombre: 'Pintura anticorrosiva',  costoUnitario: 12.00 },
};

// ─────────────────────────────────────────────────────────────────────────────
// calcularCantidadConMerma — retorna number
// ─────────────────────────────────────────────────────────────────────────────

describe('calcularCantidadConMerma', () => {
  test('aplica factor correctamente', () => {
    expect(calcularCantidadConMerma(10, 1.1, 1)).toBeCloseTo(11, 4);
  });

  test('factor 1.0 no cambia la cantidad', () => {
    expect(calcularCantidadConMerma(5, 1.0, 1)).toBe(5);
  });

  test('escala por cantidad de OP', () => {
    // 2 * 1.05 * 3 = 6.3
    expect(calcularCantidadConMerma(2, 1.05, 3)).toBeCloseTo(6.3, 4);
  });

  test('retorna number', () => {
    expect(typeof calcularCantidadConMerma(1, 1, 1)).toBe('number');
  });

  test('maneja cantidades fraccionarias', () => {
    // 0.5 * 1.2 * 2 = 1.2
    expect(calcularCantidadConMerma(0.5, 1.2, 2)).toBeCloseTo(1.2, 4);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// calcularCostoBOM — todos los campos son number
// ─────────────────────────────────────────────────────────────────────────────

describe('calcularCostoBOM', () => {
  test('lanza RangeError si unidades <= 0', () => {
    expect(() => calcularCostoBOM(BOM, MATERIALES_MAP, 0)).toThrow(RangeError);
    expect(() => calcularCostoBOM(BOM, MATERIALES_MAP, -1)).toThrow(RangeError);
  });

  test('calcula costoMateriales correctamente', () => {
    // acero:   10 * 1.1 * 5.00  = 55.00
    // pintura: 0.5 * 1.0 * 12.00 = 6.00
    const r = calcularCostoBOM(BOM, MATERIALES_MAP, 1);
    expect(r.costoMateriales).toBeCloseTo(61, 2);
  });

  test('calcula costoOperaciones correctamente', () => {
    // 20 min * 0.75 = 15.00
    const r = calcularCostoBOM(BOM, MATERIALES_MAP, 1);
    expect(r.costoOperaciones).toBeCloseTo(15, 2);
  });

  test('costoTotal = costoMateriales + costoOperaciones', () => {
    const r = calcularCostoBOM(BOM, MATERIALES_MAP, 1);
    expect(r.costoTotal).toBeCloseTo(r.costoMateriales + r.costoOperaciones, 4);
  });

  test('escala linealmente con cantidad de OP', () => {
    const r1 = calcularCostoBOM(BOM, MATERIALES_MAP, 1);
    const r5 = calcularCostoBOM(BOM, MATERIALES_MAP, 5);
    expect(r5.costoTotal).toBeCloseTo(r1.costoTotal * 5, 2);
  });

  test('expone lineas individuales con costoLinea correcto', () => {
    const r = calcularCostoBOM(BOM, MATERIALES_MAP, 1);
    expect(r.lineas).toHaveLength(2);
    expect(r.lineas[0].materialId).toBe('mat-acero');
    expect(r.lineas[0].costoLinea).toBeCloseTo(55, 2);
  });

  test('BOM sin operaciones: costoOperaciones = 0', () => {
    const bomSinOps = { ...BOM, operaciones: [] };
    const r = calcularCostoBOM(bomSinOps, MATERIALES_MAP, 1);
    expect(r.costoOperaciones).toBe(0);
    expect(r.costoTotal).toBeCloseTo(61, 2);
  });

  test('material sin precio → costoMateriales = 0', () => {
    const r = calcularCostoBOM(BOM, {}, 1);
    expect(r.costoMateriales).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validarDisponibilidadBOM
// ─────────────────────────────────────────────────────────────────────────────

describe('validarDisponibilidadBOM', () => {
  const stockSuficiente = {
    'mat-acero':   { cantidadDisponible: 20 },
    'mat-pintura': { cantidadDisponible: 5  },
  };

  const stockInsuficienteAcero = {
    'mat-acero':   { cantidadDisponible: 5  },  // necesita 11 (10 * 1.1)
    'mat-pintura': { cantidadDisponible: 5  },
  };

  test('valido:true cuando hay stock suficiente', () => {
    const r = validarDisponibilidadBOM(BOM, stockSuficiente, 1);
    expect(r.valido).toBe(true);
    expect(r.faltantes).toHaveLength(0);
  });

  test('valido:false cuando falta stock', () => {
    const r = validarDisponibilidadBOM(BOM, stockInsuficienteAcero, 1);
    expect(r.valido).toBe(false);
    expect(r.faltantes.length).toBeGreaterThan(0);
  });

  test('identifica el material faltante correcto', () => {
    const r = validarDisponibilidadBOM(BOM, stockInsuficienteAcero, 1);
    const faltante = r.faltantes.find((f) => f.materialId === 'mat-acero');
    expect(faltante).toBeDefined();
    expect(faltante!.requerido).toBeCloseTo(11, 1);
    expect(faltante!.disponible).toBe(5);
  });

  test('calcula déficit correctamente', () => {
    const r = validarDisponibilidadBOM(BOM, stockInsuficienteAcero, 1);
    const faltante = r.faltantes.find((f) => f.materialId === 'mat-acero');
    expect(faltante!.deficit).toBeCloseTo(6, 1); // 11 - 5 = 6
  });

  test('escala la necesidad con cantidad de OP', () => {
    const r = validarDisponibilidadBOM(
      BOM,
      { 'mat-acero': { cantidadDisponible: 20 }, 'mat-pintura': { cantidadDisponible: 10 } },
      3,
    );
    expect(r.valido).toBe(false);
    const faltante = r.faltantes.find((f) => f.materialId === 'mat-acero');
    expect(faltante!.requerido).toBeCloseTo(33, 1); // 10 * 1.1 * 3
  });

  test('stock vacío → todos los materiales faltan', () => {
    const r = validarDisponibilidadBOM(
      BOM,
      { 'mat-acero': { cantidadDisponible: 0 }, 'mat-pintura': { cantidadDisponible: 0 } },
      1,
    );
    expect(r.valido).toBe(false);
    expect(r.faltantes).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Transiciones de estado OP (lógica pura)
// ─────────────────────────────────────────────────────────────────────────────

describe('Transiciones de estado OP', () => {
  type EstadoOP = 'BORRADOR' | 'EN_PROCESO' | 'COMPLETADA' | 'CANCELADA';

  const VALIDAS: Record<EstadoOP, EstadoOP[]> = {
    BORRADOR:   ['EN_PROCESO', 'CANCELADA'],
    EN_PROCESO: ['COMPLETADA', 'CANCELADA'],
    COMPLETADA: [],
    CANCELADA:  [],
  };

  const esValida = (from: EstadoOP, to: EstadoOP) => VALIDAS[from].includes(to);

  test('BORRADOR → EN_PROCESO válida',   () => expect(esValida('BORRADOR',   'EN_PROCESO')).toBe(true));
  test('BORRADOR → CANCELADA válida',    () => expect(esValida('BORRADOR',   'CANCELADA')).toBe(true));
  test('BORRADOR → COMPLETADA inválida', () => expect(esValida('BORRADOR',   'COMPLETADA')).toBe(false));
  test('EN_PROCESO → COMPLETADA válida', () => expect(esValida('EN_PROCESO', 'COMPLETADA')).toBe(true));
  test('EN_PROCESO → CANCELADA válida',  () => expect(esValida('EN_PROCESO', 'CANCELADA')).toBe(true));
  test('EN_PROCESO → BORRADOR inválida', () => expect(esValida('EN_PROCESO', 'BORRADOR')).toBe(false));

  test('COMPLETADA no admite ninguna transición', () => {
    (['BORRADOR', 'EN_PROCESO', 'COMPLETADA', 'CANCELADA'] as EstadoOP[]).forEach(
      (to) => expect(esValida('COMPLETADA', to)).toBe(false),
    );
  });

  test('CANCELADA no admite ninguna transición', () => {
    (['BORRADOR', 'EN_PROCESO', 'COMPLETADA', 'CANCELADA'] as EstadoOP[]).forEach(
      (to) => expect(esValida('CANCELADA', to)).toBe(false),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Invariantes de stock
// ─────────────────────────────────────────────────────────────────────────────

describe('Invariantes de stock OP', () => {
  interface StockItem { cantidadDisponible: number; cantidadReservada: number }

  const reservar = (s: StockItem, qty: number): StockItem => {
    if (s.cantidadDisponible < qty) throw new Error('Stock insuficiente');
    return { cantidadDisponible: s.cantidadDisponible - qty, cantidadReservada: s.cantidadReservada + qty };
  };
  const consumir = (s: StockItem, qty: number): StockItem =>
    ({ cantidadDisponible: s.cantidadDisponible, cantidadReservada: Math.max(0, s.cantidadReservada - qty) });
  const liberar = (s: StockItem, qty: number): StockItem =>
    ({ cantidadDisponible: s.cantidadDisponible + qty, cantidadReservada: Math.max(0, s.cantidadReservada - qty) });

  const INICIAL: StockItem = { cantidadDisponible: 100, cantidadReservada: 0 };

  test('RESERVA: disponible baja, reservada sube', () => {
    const p = reservar(INICIAL, 30);
    expect(p.cantidadDisponible).toBe(70);
    expect(p.cantidadReservada).toBe(30);
  });

  test('RESERVA lanza error si stock insuficiente', () => {
    expect(() => reservar(INICIAL, 200)).toThrow('Stock insuficiente');
  });

  test('CONSUMO al completar: reservada baja, disponible no cambia', () => {
    const r = reservar(INICIAL, 30);
    const c = consumir(r, 30);
    expect(c.cantidadReservada).toBe(0);
    expect(c.cantidadDisponible).toBe(70);
  });

  test('LIBERACIÓN al cancelar: disponible vuelve al original', () => {
    const r = reservar(INICIAL, 30);
    const l = liberar(r, 30);
    expect(l.cantidadDisponible).toBe(100);
    expect(l.cantidadReservada).toBe(0);
  });

  test('Flujo BORRADOR→EN_PROCESO→COMPLETADA', () => {
    const r = reservar(INICIAL, 50);
    const c = consumir(r, 50);
    // el material fue consumido: disponible no sube de vuelta
    expect(c.cantidadDisponible).toBe(50);
    expect(c.cantidadReservada).toBe(0);
  });

  test('Flujo BORRADOR→EN_PROCESO→CANCELADA restaura stock', () => {
    const r = reservar(INICIAL, 50);
    const l = liberar(r, 50);
    expect(l.cantidadDisponible).toBe(INICIAL.cantidadDisponible);
    expect(l.cantidadReservada).toBe(INICIAL.cantidadReservada);
  });
});
