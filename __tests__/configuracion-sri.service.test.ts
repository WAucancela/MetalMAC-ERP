/**
 * __tests__/configuracion-sri.service.test.ts
 *
 * configuracion-sri.service.ts no tenía test (la pieza de config que sostiene
 * todo el flujo de emisión de Fase 2 — si esto devuelve mal el ambiente o el
 * emisor, se factura con los datos equivocados). Mockea supabaseAdmin igual
 * que el resto de los tests de servicio (ver inventario.service.test.ts) y usa
 * el cifrado real (no un mock) con una CERT_ENCRYPTION_KEY de prueba, para que
 * el test también cubra el round-trip cifrar/descifrar de la API key de Resend.
 *
 * Ejecutar: npx jest --no-coverage
 */

const mockSelect = jest.fn();
const mockUpsert = jest.fn();

jest.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    from: (table: string) => ({
      select: (...args: unknown[]) => mockSelect(table, ...args),
      upsert: (...args: unknown[]) => mockUpsert(table, ...args),
    }),
  },
}));

import {
  leerConfiguracionSRI,
  obtenerEstadoConfiguracionSRI,
  guardarConfiguracionSRI,
} from '../lib/services/configuracion-sri.service';
import { encriptar } from '../lib/services/cifrado.service';

const CLAVE_PRUEBA = 'a'.repeat(64); // 32 bytes en hex

beforeAll(() => {
  process.env.CERT_ENCRYPTION_KEY = CLAVE_PRUEBA;
});

beforeEach(() => jest.clearAllMocks());

function filaCompleta(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    ambiente: 'PRUEBAS',
    emisor_ruc: '1790000000001',
    emisor_razon_social: 'Taller MAC S.A.',
    emisor_nombre_comercial: 'Taller MAC',
    emisor_dir_matriz: 'Av. Siempre Viva 123',
    emisor_dir_establecimiento: 'Av. Siempre Viva 123',
    emisor_obligado_contabilidad: 'SI',
    establecimiento: '001',
    punto_emision: '100',
    resend_from_email: 'facturacion@tallermac.com',
    resend_api_key_cifrada: null,
    ...overrides,
  };
}

// select(...).eq('id', 1).maybeSingle() — se encadena desde el objeto que devuelve mockSelect.
function mockeaFila(fila: Record<string, unknown> | null) {
  mockSelect.mockReturnValue({
    eq: () => ({ maybeSingle: async () => ({ data: fila, error: null }) }),
  });
}

describe('leerConfiguracionSRI', () => {
  it('devuelve la config completa con el emisor mapeado', async () => {
    mockeaFila(filaCompleta());

    const config = await leerConfiguracionSRI();

    expect(config.ambiente).toBe('PRUEBAS');
    expect(config.emisor).toEqual({
      ruc: '1790000000001',
      razonSocial: 'Taller MAC S.A.',
      nombreComercial: 'Taller MAC',
      dirMatriz: 'Av. Siempre Viva 123',
      dirEstablecimiento: 'Av. Siempre Viva 123',
      obligadoContabilidad: 'SI',
    });
    expect(config.establecimiento).toBe('001');
    expect(config.puntoEmision).toBe('100');
    expect(config.resendApiKey).toBeNull();
  });

  it('descifra la API key de Resend cuando está guardada', async () => {
    const cifrada = encriptar('re_test_123', CLAVE_PRUEBA);
    mockeaFila(filaCompleta({ resend_api_key_cifrada: cifrada }));

    const config = await leerConfiguracionSRI();

    expect(config.resendApiKey).toBe('re_test_123');
  });

  it('tira un error claro si falta el ambiente', async () => {
    mockeaFila(filaCompleta({ ambiente: null }));

    await expect(leerConfiguracionSRI()).rejects.toThrow(/ambiente del SRI/);
  });

  it('tira un error claro si falta el RUC del emisor', async () => {
    mockeaFila(filaCompleta({ emisor_ruc: null }));

    await expect(leerConfiguracionSRI()).rejects.toThrow(/RUC del emisor/);
  });

  it('tira un error claro si no hay ninguna fila guardada todavía', async () => {
    mockeaFila(null);

    await expect(leerConfiguracionSRI()).rejects.toThrow(/ambiente del SRI/);
  });
});

describe('obtenerEstadoConfiguracionSRI', () => {
  it('nunca expone la API key, solo si está configurada', async () => {
    mockeaFila(filaCompleta({ resend_api_key_cifrada: encriptar('re_test_123', CLAVE_PRUEBA) }));

    const estado = await obtenerEstadoConfiguracionSRI();

    expect(estado.resendApiKeyConfigurada).toBe(true);
    expect(JSON.stringify(estado)).not.toContain('re_test_123');
  });

  it('devuelve null en todos los campos si no hay config guardada', async () => {
    mockeaFila(null);

    const estado = await obtenerEstadoConfiguracionSRI();

    expect(estado.ambiente).toBeNull();
    expect(estado.resendApiKeyConfigurada).toBe(false);
  });
});

describe('guardarConfiguracionSRI', () => {
  const input = {
    ambiente: 'PRUEBAS' as const,
    emisorRuc: '1790000000001',
    emisorRazonSocial: 'Taller MAC S.A.',
    emisorNombreComercial: 'Taller MAC',
    emisorDirMatriz: 'Av. Siempre Viva 123',
    emisorDirEstablecimiento: 'Av. Siempre Viva 123',
    emisorObligadoContabilidad: 'SI' as const,
    establecimiento: '001',
    puntoEmision: '100',
    resendFromEmail: 'facturacion@tallermac.com',
  };

  it('no toca resend_api_key_cifrada si no se pasa resendApiKey (no pisa el secreto guardado)', async () => {
    mockUpsert.mockResolvedValueOnce({ error: null });

    await guardarConfiguracionSRI(input, 'user-1');

    const [, fila] = mockUpsert.mock.calls[0];
    expect(fila).not.toHaveProperty('resend_api_key_cifrada');
  });

  it('cifra la API key de Resend cuando sí se pasa', async () => {
    mockUpsert.mockResolvedValueOnce({ error: null });

    await guardarConfiguracionSRI({ ...input, resendApiKey: 're_nueva_123' }, 'user-1');

    const [, fila] = mockUpsert.mock.calls[0];
    expect(fila.resend_api_key_cifrada).toBeDefined();
    expect(fila.resend_api_key_cifrada).not.toContain('re_nueva_123');
  });

  it('propaga el error de Postgres si el upsert falla', async () => {
    mockUpsert.mockResolvedValueOnce({ error: { message: 'boom' } });

    await expect(guardarConfiguracionSRI(input, 'user-1')).rejects.toBeTruthy();
  });
});
