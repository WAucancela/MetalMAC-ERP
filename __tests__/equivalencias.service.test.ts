/**
 * __tests__/equivalencias.service.test.ts
 *
 * Tests unitarios para las funciones puras de equivalencias.service.ts.
 * No requieren IO — resolverLineaContra y construirEquivalencia no tocan la DB.
 *
 * lib/supabase/admin.ts inicializa el cliente al importarse (lanza si faltan
 * las variables de entorno), así que se mockea antes de importar el servicio.
 */

jest.mock('@/lib/supabase/admin', () => ({ supabaseAdmin: {} }));

import {
  resolverLineaContra,
  construirEquivalencia,
} from '../lib/services/equivalencias.service';
import type { LineaXML, TablaEquivalencia } from '../types/metalmac.types';

// ─────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────

function makeLinea(overrides: Partial<LineaXML> = {}): LineaXML {
  return {
    codigoInterno: 'PROV-001',
    codigoAdicional: '',
    descripcion: 'PLANCHA INOX 304 3MM',
    cantidad: 5,
    precioUnitario: 20,
    descuento: 0,
    precioTotalSinImpuesto: 100,
    ...overrides,
  };
}

function makeEquivalencia(overrides: Partial<TablaEquivalencia> = {}): TablaEquivalencia {
  return {
    id: 'eq-1',
    proveedorId: 'prov-1',
    codigoProveedor: 'PROV-001',
    descripcionProveedor: 'plancha inox 304 3mm',
    materialId: 'mat-plancha-304-3mm',
    unidadProveedorId: 'u-pza',
    factorConversion: 2.44,
    precioReferencia: 20,
    activo: true,
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// resolverLineaContra
// ─────────────────────────────────────────────

describe('resolverLineaContra', () => {
  it('resuelve por coincidencia exacta de codigoInterno (prioridad 1)', () => {
    const linea = makeLinea({ codigoInterno: 'PROV-001' });
    const equivalencias = [makeEquivalencia({ codigoProveedor: 'PROV-001' })];

    const result = resolverLineaContra(linea, equivalencias);

    expect(result.resuelta).toBe(true);
    expect(result.materialId).toBe('mat-plancha-304-3mm');
    expect(result.equivalenciaId).toBe('eq-1');
  });

  it('resuelve por codigoAdicional cuando codigoInterno no matchea (prioridad 2)', () => {
    const linea = makeLinea({ codigoInterno: 'SIN-MATCH', codigoAdicional: 'AUX-99' });
    const equivalencias = [makeEquivalencia({ codigoProveedor: 'AUX-99' })];

    const result = resolverLineaContra(linea, equivalencias);

    expect(result.resuelta).toBe(true);
    expect(result.equivalenciaId).toBe('eq-1');
  });

  it('resuelve por descripción parcial case-insensitive cuando no hay match por código (prioridad 3)', () => {
    const linea = makeLinea({
      codigoInterno: 'SIN-MATCH',
      codigoAdicional: '',
      descripcion: 'Plancha Inox 304 3mm 1220x2440',
    });
    const equivalencias = [makeEquivalencia({
      codigoProveedor: 'OTRO-CODIGO',
      descripcionProveedor: 'plancha inox 304 3mm',
    })];

    const result = resolverLineaContra(linea, equivalencias);

    expect(result.resuelta).toBe(true);
    expect(result.equivalenciaId).toBe('eq-1');
  });

  it('prioriza codigoInterno sobre codigoAdicional y descripción', () => {
    const linea = makeLinea({ codigoInterno: 'CORRECTO', codigoAdicional: 'AUX-99' });
    const equivalencias = [
      makeEquivalencia({ id: 'eq-aux', codigoProveedor: 'AUX-99' }),
      makeEquivalencia({ id: 'eq-correcto', codigoProveedor: 'CORRECTO' }),
    ];

    const result = resolverLineaContra(linea, equivalencias);

    expect(result.equivalenciaId).toBe('eq-correcto');
  });

  it('no resuelve y retorna campos null cuando no hay ninguna coincidencia', () => {
    const linea = makeLinea({
      codigoInterno: 'SIN-MATCH',
      codigoAdicional: 'TAMPOCO',
      descripcion: 'Producto totalmente distinto',
    });
    const equivalencias = [makeEquivalencia()];

    const result = resolverLineaContra(linea, equivalencias);

    expect(result.resuelta).toBe(false);
    expect(result.materialId).toBeNull();
    expect(result.cantidadConvertida).toBeNull();
    expect(result.factorConversion).toBeNull();
    expect(result.equivalenciaId).toBeNull();
  });

  it('no resuelve cuando la lista de equivalencias está vacía', () => {
    const result = resolverLineaContra(makeLinea(), []);
    expect(result.resuelta).toBe(false);
  });

  it('no hace match por descripción vacía (regresión: "".includes() siempre es true)', () => {
    // Si la línea no trae descripción ni código, no debe emparejar "por accidente"
    // con la primera equivalencia de la lista.
    const linea = makeLinea({
      codigoInterno: '',
      codigoAdicional: '',
      descripcion: '   ', // solo espacios → normaliza a ''
    });
    const equivalencias = [makeEquivalencia({ codigoProveedor: 'ALGO-DISTINTO' })];

    const result = resolverLineaContra(linea, equivalencias);

    expect(result.resuelta).toBe(false);
  });

  it('no hace match contra una equivalencia con descripcionProveedor vacía', () => {
    const linea = makeLinea({
      codigoInterno: 'SIN-MATCH',
      codigoAdicional: '',
      descripcion: 'Cualquier descripción',
    });
    const equivalencias = [makeEquivalencia({
      codigoProveedor: 'OTRO',
      descripcionProveedor: '   ',
    })];

    const result = resolverLineaContra(linea, equivalencias);

    expect(result.resuelta).toBe(false);
  });

  it('calcula cantidadConvertida = cantidad * factorConversion con precisión decimal', () => {
    const linea = makeLinea({ codigoInterno: 'PROV-001', cantidad: 5 });
    const equivalencias = [makeEquivalencia({ codigoProveedor: 'PROV-001', factorConversion: 2.44 })];

    const result = resolverLineaContra(linea, equivalencias);

    expect(result.cantidadConvertida).toBeCloseTo(12.2, 6);
    expect(result.factorConversion).toBe(2.44);
  });
});

// ─────────────────────────────────────────────
// construirEquivalencia
// ─────────────────────────────────────────────

describe('construirEquivalencia', () => {
  it('usa codigoInterno como codigoProveedor cuando está presente', () => {
    const linea = makeLinea({ codigoInterno: 'PROV-001', codigoAdicional: 'AUX-99' });

    const result = construirEquivalencia('prov-1', linea, 'mat-1', 2.44);

    expect(result.codigoProveedor).toBe('PROV-001');
    expect(result.proveedorId).toBe('prov-1');
    expect(result.materialId).toBe('mat-1');
    expect(result.factorConversion).toBe(2.44);
    expect(result.activo).toBe(true);
  });

  it('usa codigoAdicional como fallback cuando codigoInterno está vacío', () => {
    const linea = makeLinea({ codigoInterno: '', codigoAdicional: 'AUX-99' });

    const result = construirEquivalencia('prov-1', linea, 'mat-1', 1);

    expect(result.codigoProveedor).toBe('AUX-99');
  });

  it('copia descripcionProveedor y precioReferencia desde la línea', () => {
    const linea = makeLinea({ descripcion: 'Descripción X', precioUnitario: 42.5 });

    const result = construirEquivalencia('prov-1', linea, 'mat-1', 1);

    expect(result.descripcionProveedor).toBe('Descripción X');
    expect(result.precioReferencia).toBe(42.5);
  });
});
