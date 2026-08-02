/**
 * __tests__/configuracion-sri.schema.test.ts
 * Tests de validación Zod para lib/validations/configuracion-sri.schema.ts
 */

import { ConfiguracionSRISchema } from '../lib/validations/configuracion-sri.schema';

describe('ConfiguracionSRISchema', () => {
  const base = {
    ambiente: 'PRUEBAS' as const,
    emisorRuc: '0994008740001',
    emisorRazonSocial: 'MetalMAC S.A.',
    emisorNombreComercial: 'MetalMAC',
    emisorDirMatriz: 'Av. Principal 123, Guayaquil',
    emisorDirEstablecimiento: 'Av. Principal 123, Guayaquil',
    emisorObligadoContabilidad: 'SI' as const,
    resendFromEmail: 'facturacion@metalmac.com',
  };

  it('acepta una configuración válida sin resendApiKey', () => {
    expect(ConfiguracionSRISchema.safeParse(base).success).toBe(true);
  });

  it('acepta con resendApiKey presente', () => {
    expect(ConfiguracionSRISchema.safeParse({ ...base, resendApiKey: 're_test_123' }).success).toBe(true);
  });

  it('rechaza un ambiente fuera de PRUEBAS/PRODUCCION', () => {
    expect(ConfiguracionSRISchema.safeParse({ ...base, ambiente: 'STAGING' }).success).toBe(false);
  });

  it('rechaza un RUC que no tenga 13 dígitos', () => {
    expect(ConfiguracionSRISchema.safeParse({ ...base, emisorRuc: '123' }).success).toBe(false);
  });

  it('rechaza un RUC con letras', () => {
    expect(ConfiguracionSRISchema.safeParse({ ...base, emisorRuc: '099400874000A' }).success).toBe(false);
  });

  it('rechaza obligadoContabilidad fuera de SI/NO', () => {
    expect(ConfiguracionSRISchema.safeParse({ ...base, emisorObligadoContabilidad: 'TALVEZ' }).success).toBe(false);
  });

  it('rechaza un email remitente inválido', () => {
    expect(ConfiguracionSRISchema.safeParse({ ...base, resendFromEmail: 'no-es-un-email' }).success).toBe(false);
  });
});
