/**
 * __tests__/sri-firma.service.test.ts
 *
 * No usamos el .p12 real del taller acá — generamos un certificado autofirmado con
 * node-forge en memoria para ejercitar el pipeline completo (extraer .p12 → armar
 * CryptoKey → firmar XML) sin depender de un secreto real. Esto prueba que el código
 * corre de punta a punta, NO que el SRI vaya a aceptar la firma — eso solo se
 * confirma probando contra el ambiente de pruebas del SRI con el certificado real.
 */
import forge from 'node-forge';
import { extraerCertificado, firmarXML } from '../lib/services/sri-firma.service';

function generarP12DePrueba(password: string): string {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

  const attrs = [{ name: 'commonName', value: 'MetalMAC Test' }, { name: 'countryName', value: 'EC' }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, cert, password, { algorithm: 'aes256' });
  const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
  return forge.util.encode64(p12Der);
}

describe('extraerCertificado + firmarXML (pipeline con certificado de prueba)', () => {
  const password = 'clave-de-prueba-123';
  let p12Base64: string;

  beforeAll(() => {
    p12Base64 = generarP12DePrueba(password);
  });

  it('extrae la clave privada y el certificado del .p12', async () => {
    const cert = await extraerCertificado(p12Base64, password);
    expect(cert.claveCryptoKey).toBeDefined();
    expect(cert.certificadoBase64Der.length).toBeGreaterThan(0);
  });

  it('rechaza una contraseña incorrecta con un error claro', async () => {
    await expect(extraerCertificado(p12Base64, 'contraseña-incorrecta')).rejects.toThrow(
      /No se pudo leer el archivo \.p12/,
    );
  });

  it('firma un XML y produce un documento con <Signature> insertado', async () => {
    const certificado = await extraerCertificado(p12Base64, password);
    const xmlSinFirmar = '<?xml version="1.0" encoding="UTF-8"?><factura id="comprobante" version="1.1.0"><infoTributaria><ruc>0994008740001</ruc></infoTributaria></factura>';

    const xmlFirmado = await firmarXML(xmlSinFirmar, certificado);

    // xadesjs serializa el nodo con prefijo de namespace (ds:Signature), no "Signature" a secas.
    expect(xmlFirmado).toContain(':Signature');
    expect(xmlFirmado).toContain('SignedInfo');
    expect(xmlFirmado).toContain('SignatureValue');
    expect(xmlFirmado).toContain('X509Certificate');
    expect(xmlFirmado).toContain('QualifyingProperties');
    expect(xmlFirmado).toContain('SigningCertificate');
    // El contenido original de la factura tiene que seguir intacto.
    expect(xmlFirmado).toContain('<ruc>0994008740001</ruc>');
  }, 15_000);
});
