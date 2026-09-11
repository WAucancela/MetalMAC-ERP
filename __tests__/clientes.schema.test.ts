/**
 * __tests__/clientes.schema.test.ts
 * Tests de validación Zod para lib/validations/clientes.schema.ts
 */

import { ClienteSchema, ClientesQuerySchema, InteraccionSchema } from '../lib/validations/clientes.schema';

describe('ClienteSchema', () => {
  const base = {
    razonSocial: 'Constructora XYZ S.A.',
  };

  it('acepta el mínimo válido (solo razón social) y aplica defaults', () => {
    const result = ClienteSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.identificacion).toBeNull();
      expect(result.data.tipoIdentificacion).toBeNull();
      expect(result.data.activo).toBe(true);
      expect(result.data.email).toBe('');
    }
  });

  it('rechaza razón social vacía', () => {
    expect(ClienteSchema.safeParse({ razonSocial: '' }).success).toBe(false);
  });

  it('acepta un cliente completo con RUC', () => {
    const result = ClienteSchema.safeParse({
      ...base,
      tipoIdentificacion: 'RUC',
      identificacion: '0999999999001',
      email: 'compras@xyz.com',
      telefono: '0999000000',
      ciudad: 'Guayaquil',
    });
    expect(result.success).toBe(true);
  });

  it('rechaza un email con formato inválido', () => {
    expect(ClienteSchema.safeParse({ ...base, email: 'no-es-un-email' }).success).toBe(false);
  });

  it('acepta email vacío (opcional)', () => {
    expect(ClienteSchema.safeParse({ ...base, email: '' }).success).toBe(true);
  });

  it('rechaza un tipoIdentificacion fuera del enum', () => {
    expect(ClienteSchema.safeParse({ ...base, tipoIdentificacion: 'DNI' }).success).toBe(false);
  });
});

describe('ClientesQuerySchema', () => {
  it('aplica defaults de paginación', () => {
    const result = ClientesQuerySchema.parse({});
    expect(result.limit).toBe(50);
    expect(result.page).toBe(1);
  });

  it('coerciona "activo" de string a boolean', () => {
    expect(ClientesQuerySchema.parse({ activo: 'true' }).activo).toBe(true);
    expect(ClientesQuerySchema.parse({ activo: 'false' }).activo).toBe(false);
  });

  it('acepta límite hasta 500 (uso de catálogo completo sin paginar)', () => {
    expect(ClientesQuerySchema.safeParse({ limit: '500' }).success).toBe(true);
  });

  it('rechaza límite mayor a 500', () => {
    expect(ClientesQuerySchema.safeParse({ limit: '501' }).success).toBe(false);
  });
});

describe('InteraccionSchema', () => {
  it('acepta una nota válida', () => {
    const result = InteraccionSchema.safeParse({ tipo: 'NOTA', descripcion: 'Llamó por la cotización' });
    expect(result.success).toBe(true);
  });

  it('rechaza descripción vacía', () => {
    expect(InteraccionSchema.safeParse({ tipo: 'NOTA', descripcion: '' }).success).toBe(false);
  });

  it('rechaza un tipo fuera del enum', () => {
    expect(InteraccionSchema.safeParse({ tipo: 'WHATSAPP', descripcion: 'x' }).success).toBe(false);
  });
});
