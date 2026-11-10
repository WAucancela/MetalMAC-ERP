/**
 * __tests__/certificado.service.test.ts
 *
 * certificado.service.ts no tenía test — es la pieza que guarda/lee el .p12 de
 * firma (Storage) y su contraseña (cifrada en Postgres). Mockea supabaseAdmin
 * (tablas + storage) igual que el resto de los tests de servicio, y usa el
 * cifrado real con una CERT_ENCRYPTION_KEY de prueba para que el test cubra el
 * round-trip cifrar/descifrar de la contraseña (no solo que "algo" se guardó).
 * `extraerCertificado` (parseo real de .p12 con node-forge) se mockea acá — eso
 * ya lo cubre sri-firma.service.test.ts por su cuenta.
 *
 * Ejecutar: npx jest --no-coverage
 */

const mockSelect = jest.fn();
const mockUpdate = jest.fn();
const mockInsert = jest.fn();
const mockStorageUpload = jest.fn();
const mockStorageDownload = jest.fn();
const mockExtraerCertificado = jest.fn();

jest.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    from: (table: string) => ({
      select: (...args: unknown[]) => mockSelect(table, ...args),
      update: (...args: unknown[]) => mockUpdate(table, ...args),
      insert: (...args: unknown[]) => mockInsert(table, ...args),
    }),
    storage: {
      from: (bucket: string) => ({
        upload: (...args: unknown[]) => mockStorageUpload(bucket, ...args),
        download: (...args: unknown[]) => mockStorageDownload(bucket, ...args),
      }),
    },
  },
}));

jest.mock('@/lib/services/sri-firma.service', () => ({
  extraerCertificado: (...args: unknown[]) => mockExtraerCertificado(...args),
}));

import {
  subirCertificado,
  cargarCertificadoActivo,
  obtenerEstadoCertificado,
  CertificadoInvalidoError,
} from '../lib/services/certificado.service';
import { encriptar } from '../lib/services/cifrado.service';

const CLAVE_PRUEBA = 'b'.repeat(64); // 32 bytes en hex

beforeAll(() => {
  process.env.CERT_ENCRYPTION_KEY = CLAVE_PRUEBA;
});

beforeEach(() => jest.clearAllMocks());

function mockeaFilaActiva(fila: Record<string, unknown> | null) {
  mockSelect.mockReturnValue({ eq: () => ({ maybeSingle: async () => ({ data: fila, error: null }) }) });
}

describe('cargarCertificadoActivo', () => {
  it('devuelve null si no hay ningún certificado activo', async () => {
    mockeaFilaActiva(null);

    const resultado = await cargarCertificadoActivo();

    expect(resultado).toBeNull();
    expect(mockStorageDownload).not.toHaveBeenCalled();
  });

  it('descarga el .p12 y descifra la contraseña del certificado activo', async () => {
    const contenido = Buffer.from('contenido-p12-de-prueba');
    mockeaFilaActiva({
      storage_path: 'cert-123.p12',
      password_cifrada: encriptar('clave-real-del-p12', CLAVE_PRUEBA),
      vigencia_hasta: '2027-05-01',
    });
    mockStorageDownload.mockResolvedValueOnce({
      data: { arrayBuffer: async () => contenido.buffer.slice(contenido.byteOffset, contenido.byteOffset + contenido.byteLength) },
      error: null,
    });

    const resultado = await cargarCertificadoActivo();

    expect(resultado).not.toBeNull();
    expect(resultado!.password).toBe('clave-real-del-p12');
    expect(Buffer.from(resultado!.p12Base64, 'base64').toString()).toBe('contenido-p12-de-prueba');
    expect(resultado!.vigenciaHasta).toEqual(new Date('2027-05-01'));
    expect(mockStorageDownload).toHaveBeenCalledWith('certificados-firma', 'cert-123.p12');
  });

  it('propaga el error si falla la descarga de Storage', async () => {
    mockeaFilaActiva({ storage_path: 'cert-123.p12', password_cifrada: 'x', vigencia_hasta: null });
    mockStorageDownload.mockResolvedValueOnce({ data: null, error: { message: 'no encontrado' } });

    await expect(cargarCertificadoActivo()).rejects.toBeTruthy();
  });
});

describe('obtenerEstadoCertificado', () => {
  it('nunca expone la contraseña, ni cifrada', async () => {
    mockeaFilaActiva({ vigencia_hasta: '2027-05-01', subido_en: '2026-01-01T00:00:00Z', password_cifrada: 'secreto-cifrado' });

    const estado = await obtenerEstadoCertificado();

    expect(estado.vigenciaHasta).toEqual(new Date('2027-05-01'));
    expect(JSON.stringify(estado)).not.toContain('secreto-cifrado');
  });

  it('devuelve nulls si no hay certificado activo', async () => {
    mockeaFilaActiva(null);

    const estado = await obtenerEstadoCertificado();

    expect(estado).toEqual({ vigenciaHasta: null, subidoEn: null });
  });
});

describe('subirCertificado', () => {
  const fileBuffer = Buffer.from('contenido-p12-de-prueba');

  it('lanza CertificadoInvalidoError si el .p12/contraseña no son válidos, sin tocar Storage/DB', async () => {
    mockExtraerCertificado.mockRejectedValueOnce(new Error('MAC verify failure'));

    await expect(subirCertificado(fileBuffer, 'mala-clave', 'user-1')).rejects.toThrow(CertificadoInvalidoError);
    expect(mockStorageUpload).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('sube el archivo, desactiva el certificado anterior y guarda la contraseña cifrada', async () => {
    mockExtraerCertificado.mockResolvedValueOnce({
      claveCryptoKey: {} as CryptoKey,
      certificadoBase64Der: 'der-fake',
      vigenciaHasta: new Date('2027-05-01'),
    });
    mockStorageUpload.mockResolvedValueOnce({ error: null });
    const mockEqUpdate = jest.fn(async () => ({ error: null }));
    mockUpdate.mockReturnValue({ eq: mockEqUpdate });
    mockInsert.mockResolvedValueOnce({ error: null });

    const resultado = await subirCertificado(fileBuffer, 'clave-real-del-p12', 'user-1');

    expect(resultado.vigenciaHasta).toEqual(new Date('2027-05-01'));
    expect(mockStorageUpload).toHaveBeenCalledWith(
      'certificados-firma',
      expect.stringMatching(/^cert-\d+\.p12$/),
      fileBuffer,
      { contentType: 'application/x-pkcs12' },
    );
    expect(mockUpdate).toHaveBeenCalledWith('certificados_firma', { activo: false });
    expect(mockEqUpdate).toHaveBeenCalledWith('activo', true);

    const [, filaInsertada] = mockInsert.mock.calls[0];
    expect(filaInsertada.activo).toBe(true);
    expect(filaInsertada.subido_por).toBe('user-1');
    expect(filaInsertada.password_cifrada).not.toContain('clave-real-del-p12');
  });

  it('propaga el error si falla la subida a Storage (no desactiva el certificado anterior)', async () => {
    mockExtraerCertificado.mockResolvedValueOnce({
      claveCryptoKey: {} as CryptoKey,
      certificadoBase64Der: 'der-fake',
      vigenciaHasta: new Date('2027-05-01'),
    });
    mockStorageUpload.mockResolvedValueOnce({ error: { message: 'storage caído' } });

    await expect(subirCertificado(fileBuffer, 'clave-real-del-p12', 'user-1')).rejects.toBeTruthy();
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
