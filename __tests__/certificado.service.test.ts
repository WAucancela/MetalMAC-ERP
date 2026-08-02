/**
 * __tests__/certificado.service.test.ts
 * Tests de las funciones puras de lib/services/certificado.service.ts
 * (el cifrado/descifrado de la contraseña del certificado — sin tocar Storage/DB).
 *
 * certificado.service.ts importa supabaseAdmin, que inicializa el cliente al
 * cargarse (lanza si faltan las variables de entorno) — se mockea antes de
 * importar el servicio, mismo criterio que bom.service.test.ts.
 */

jest.mock('@/lib/supabase/admin', () => ({ supabaseAdmin: {} }));

import crypto from 'crypto';
import { encriptarPassword, desencriptarPassword } from '../lib/services/certificado.service';

const claveHex = crypto.randomBytes(32).toString('hex');

describe('encriptarPassword / desencriptarPassword', () => {
  it('desencripta lo mismo que se encriptó (round-trip)', () => {
    const original = 'clave-super-secreta-del-p12';
    const cifrado = encriptarPassword(original, claveHex);
    expect(desencriptarPassword(cifrado, claveHex)).toBe(original);
  });

  it('el valor cifrado no contiene la contraseña en texto plano', () => {
    const original = 'clave-super-secreta-del-p12';
    const cifrado = encriptarPassword(original, claveHex);
    expect(cifrado).not.toContain(original);
  });

  it('dos cifrados de la misma contraseña son distintos (IV aleatorio)', () => {
    const original = 'misma-clave';
    const cifrado1 = encriptarPassword(original, claveHex);
    const cifrado2 = encriptarPassword(original, claveHex);
    expect(cifrado1).not.toBe(cifrado2);
  });

  it('rechaza desencriptar con una clave distinta a la usada para encriptar', () => {
    const otraClaveHex = crypto.randomBytes(32).toString('hex');
    const cifrado = encriptarPassword('clave', claveHex);
    expect(() => desencriptarPassword(cifrado, otraClaveHex)).toThrow();
  });

  it('rechaza una CERT_ENCRYPTION_KEY que no sea de 32 bytes', () => {
    expect(() => encriptarPassword('clave', 'muycorta')).toThrow(/32 bytes/);
  });
});
