/**
 * __tests__/sri.schema.test.ts
 * Tests de validación Zod para lib/validations/sri.schema.ts
 */

import {
  ProveedorSchema,
  TablaEquivalenciaSchema,
  MapearLineaFacturaSchema,
  FacturaCompraSchema,
  ResolverEquivalenciasSchema,
  FacturasQuerySchema,
  ProveedoresQuerySchema,
} from '../lib/validations/sri.schema';

describe('ProveedorSchema', () => {
  const base = {
    ruc: '0994008740001',
    razonSocial: 'Aceros del Ecuador S.A.',
    nombreComercial: 'Aceros EC',
    tipoContribuyente: 'SOCIEDAD',
    telefonoPrincipal: '042345678',
    emailPrincipal: 'contacto@acerosec.com',
    ciudad: 'Guayaquil',
  };

  it('acepta un proveedor válido y aplica defaults', () => {
    const result = ProveedorSchema.parse(base);
    expect(result.diasCredito).toBe(30);
    expect(result.activo).toBe(true);
    expect(result.contribuyenteEspecial).toBe(false);
  });

  it('rechaza RUC con menos de 13 dígitos', () => {
    expect(ProveedorSchema.safeParse({ ...base, ruc: '099400874' }).success).toBe(false);
  });

  it('rechaza RUC con letras', () => {
    expect(ProveedorSchema.safeParse({ ...base, ruc: '099400874000A' }).success).toBe(false);
  });

  it('rechaza email inválido', () => {
    expect(ProveedorSchema.safeParse({ ...base, emailPrincipal: 'no-es-email' }).success).toBe(false);
  });

  it('rechaza tipoContribuyente fuera del enum', () => {
    expect(ProveedorSchema.safeParse({ ...base, tipoContribuyente: 'EXTRANJERO' }).success).toBe(false);
  });

  it('rechaza diasCredito fuera de rango (> 365)', () => {
    expect(ProveedorSchema.safeParse({ ...base, diasCredito: 400 }).success).toBe(false);
  });
});

describe('TablaEquivalenciaSchema', () => {
  const base = {
    proveedorId: 'prov-1',
    codigoProveedor: 'COD-001',
    descripcionProveedor: 'Plancha inox',
    materialId: 'mat-1',
    unidadProveedorId: 'u-1',
    factorConversion: 2.44,
    precioReferencia: 20,
  };

  it('acepta una equivalencia válida', () => {
    expect(TablaEquivalenciaSchema.safeParse(base).success).toBe(true);
  });

  it('rechaza factorConversion <= 0', () => {
    expect(TablaEquivalenciaSchema.safeParse({ ...base, factorConversion: 0 }).success).toBe(false);
  });

  it('rechaza precioReferencia negativo', () => {
    expect(TablaEquivalenciaSchema.safeParse({ ...base, precioReferencia: -1 }).success).toBe(false);
  });
});

describe('MapearLineaFacturaSchema', () => {
  const base = { materialId: 'mat-1', unidadProveedorId: 'u-1', factorConversion: 2.44 };

  it('acepta un mapeo válido', () => {
    expect(MapearLineaFacturaSchema.safeParse(base).success).toBe(true);
  });

  it('aplica default 1 a factorConversion si se omite', () => {
    const { materialId, unidadProveedorId } = base;
    const result = MapearLineaFacturaSchema.parse({ materialId, unidadProveedorId });
    expect(result.factorConversion).toBe(1);
  });

  it('rechaza factorConversion <= 0', () => {
    expect(MapearLineaFacturaSchema.safeParse({ ...base, factorConversion: 0 }).success).toBe(false);
  });

  it('rechaza materialId vacío', () => {
    expect(MapearLineaFacturaSchema.safeParse({ ...base, materialId: '' }).success).toBe(false);
  });
});

describe('FacturaCompraSchema', () => {
  // Clave de acceso de 49 dígitos válida a nivel de formato (el dígito verificador
  // real se valida en sri.service.ts, no en este schema — aquí solo se exige longitud/dígitos).
  const claveAcceso = '0'.repeat(49);

  const base = {
    proveedorId: 'prov-1',
    claveAcceso,
    numeroFactura: '001-001-000000001',
    fechaEmision: '2026-02-10',
    subtotalSinIva: 100,
    iva: 15,
    total: 115,
    lineas: [{
      codigoProveedor: 'COD-001',
      descripcion: 'Plancha inox',
      cantidad: 5,
      precioUnitario: 20,
      subtotal: 100,
    }],
  };

  it('acepta una factura válida y aplica default de estado', () => {
    const result = FacturaCompraSchema.parse(base);
    expect(result.estado).toBe('PENDIENTE');
    expect(result.retenciones).toEqual([]);
  });

  it('rechaza claveAcceso con longitud distinta a 49', () => {
    expect(FacturaCompraSchema.safeParse({ ...base, claveAcceso: '123' }).success).toBe(false);
  });

  it('rechaza numeroFactura con formato incorrecto', () => {
    expect(
      FacturaCompraSchema.safeParse({ ...base, numeroFactura: '1-1-1' }).success,
    ).toBe(false);
  });

  it('rechaza una factura sin líneas', () => {
    expect(FacturaCompraSchema.safeParse({ ...base, lineas: [] }).success).toBe(false);
  });

  it('rechaza totales negativos', () => {
    expect(FacturaCompraSchema.safeParse({ ...base, total: -1 }).success).toBe(false);
  });
});

describe('ResolverEquivalenciasSchema', () => {
  const base = {
    proveedorId: 'prov-1',
    lineas: [{
      codigoInterno: 'COD-001',
      codigoAdicional: '',
      descripcion: 'Plancha inox',
      cantidad: 5,
      precioUnitario: 20,
      descuento: 0,
      precioTotalSinImpuesto: 100,
    }],
  };

  it('acepta un request válido', () => {
    expect(ResolverEquivalenciasSchema.safeParse(base).success).toBe(true);
  });

  it('rechaza lineas vacías', () => {
    expect(ResolverEquivalenciasSchema.safeParse({ ...base, lineas: [] }).success).toBe(false);
  });

  it('rechaza cantidad <= 0 en una línea', () => {
    const invalid = { ...base, lineas: [{ ...base.lineas[0], cantidad: 0 }] };
    expect(ResolverEquivalenciasSchema.safeParse(invalid).success).toBe(false);
  });
});

describe('FacturasQuerySchema', () => {
  it('aplica el límite por defecto de 20', () => {
    expect(FacturasQuerySchema.parse({}).limit).toBe(20);
  });

  it('rechaza un estado inválido', () => {
    expect(FacturasQuerySchema.safeParse({ estado: 'RECIBIDA' }).success).toBe(false);
  });
});

describe('ProveedoresQuerySchema', () => {
  it('coerciona "activo" a boolean', () => {
    expect(ProveedoresQuerySchema.parse({ activo: 'false' }).activo).toBe(false);
  });

  it('aplica el límite por defecto de 50', () => {
    expect(ProveedoresQuerySchema.parse({}).limit).toBe(50);
  });
});
