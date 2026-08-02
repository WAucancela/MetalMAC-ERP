/**
 * __tests__/cifrado.service.test.ts
 * Tests de las funciones puras de lib/services/cifrado.service.ts.
 */

import crypto from 'crypto';
import { encriptar, desencriptar } from '../lib/services/cifrado.service';

const claveHex = crypto.randomBytes(32).toString('hex');

describe('encriptar / desencriptar', () => {
  it('desencripta lo mismo que se encriptó (round-trip)', () => {
    const original = 'clave-super-secreta-del-p12';
    const cifrado = encriptar(original, claveHex);
    expect(desencriptar(cifrado, claveHex)).toBe(original);
  });

  it('el valor cifrado no contiene el texto plano', () => {
    const original = 'clave-super-secreta-del-p12';
    const cifrado = encriptar(original, claveHex);
    expect(cifrado).not.toContain(original);
  });

  it('dos cifrados del mismo texto son distintos (IV aleatorio)', () => {
    const original = 'misma-clave';
    const cifrado1 = encriptar(original, claveHex);
    const cifrado2 = encriptar(original, claveHex);
    expect(cifrado1).not.toBe(cifrado2);
  });

  it('rechaza desencriptar con una clave distinta a la usada para encriptar', () => {
    const otraClaveHex = crypto.randomBytes(32).toString('hex');
    const cifrado = encriptar('clave', claveHex);
    expect(() => desencriptar(cifrado, otraClaveHex)).toThrow();
  });

  it('rechaza una clave que no sea de 32 bytes', () => {
    expect(() => encriptar('clave', 'muycorta')).toThrow(/32 bytes/);
  });
});
