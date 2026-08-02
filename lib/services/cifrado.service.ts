/**
 * cifrado.service.ts — cifrado simétrico de secretos que se guardan en la base
 * de datos (contraseña del certificado .p12, API key de Resend, etc.). Nunca se
 * guarda un secreto en texto plano.
 *
 * AES-256-GCM con Node `crypto` nativo, clave de `CERT_ENCRYPTION_KEY` (32 bytes
 * en hex, se configura una sola vez en Vercel y no cambia). Nunca se usa
 * pgcrypto/RPC de Postgres para esto — todo corre en Node, evita pasar la clave
 * a través de SQL.
 */

import crypto from 'crypto';

/**
 * Cifra `textoPlano` con AES-256-GCM. `claveHex` son 32 bytes en hex (64
 * caracteres). Devuelve base64 de `iv (12) + authTag (16) + ciphertext`.
 */
export function encriptar(textoPlano: string, claveHex: string): string {
  const clave = Buffer.from(claveHex, 'hex');
  if (clave.length !== 32) {
    throw new Error('CERT_ENCRYPTION_KEY debe ser 32 bytes en hex (64 caracteres)');
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', clave, iv);
  const cifrado = Buffer.concat([cipher.update(textoPlano, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, cifrado]).toString('base64');
}

/** Inversa de `encriptar`. */
export function desencriptar(cifradoBase64: string, claveHex: string): string {
  const clave = Buffer.from(claveHex, 'hex');
  if (clave.length !== 32) {
    throw new Error('CERT_ENCRYPTION_KEY debe ser 32 bytes en hex (64 caracteres)');
  }
  const datos = Buffer.from(cifradoBase64, 'base64');
  const iv = datos.subarray(0, 12);
  const authTag = datos.subarray(12, 28);
  const cifrado = datos.subarray(28);

  const decipher = crypto.createDecipheriv('aes-256-gcm', clave, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(cifrado), decipher.final()]).toString('utf8');
}

/** Lee CERT_ENCRYPTION_KEY del entorno — sin default, tira si no está seteada. */
export function leerClaveCifrado(): string {
  const clave = process.env.CERT_ENCRYPTION_KEY;
  if (!clave) throw new Error('Falta configurar CERT_ENCRYPTION_KEY');
  return clave;
}
