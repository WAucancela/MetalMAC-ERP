/**
 * sri-firma.service.ts — firma XAdES-BES de un XML de factura con el .p12 del taller.
 *
 * ADVERTENCIA: esta es la pieza más delicada de toda la Fase 2. Las llamadas a
 * xadesjs/xmldsigjs/node-forge de acá se escribieron leyendo los .d.ts reales
 * instalados en node_modules (no de memoria), así que si algo cambió de forma
 * incompatible con lo esperado acá, `tsc` debería fallar en vez de generar una firma
 * silenciosamente incorrecta. Aun así, hay que probar el flujo completo contra el
 * ambiente de PRUEBAS del SRI con una factura real antes de confiar en esto para
 * producción — el SRI rechaza un comprobante mal firmado sin un error claro del
 * lado nuestro.
 *
 * Node no tiene DOMParser/XMLSerializer nativos, que es lo que xadesjs necesita para
 * parsear y volver a serializar el XML — se registran acá con @xmldom/xmldom.
 */
import forge from 'node-forge';
import { Crypto } from '@peculiar/webcrypto';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import * as xpath from 'xpath';
import * as xadesjs from 'xadesjs';

let motorInicializado = false;

function inicializarMotor(): void {
  if (motorInicializado) return;
  xadesjs.setNodeDependencies({
    DOMParser: DOMParser as unknown as typeof globalThis.DOMParser,
    XMLSerializer: XMLSerializer as unknown as typeof globalThis.XMLSerializer,
    xpath: { select: xpath.select },
  });
  xadesjs.Application.setEngine('NodeJS', new Crypto());
  motorInicializado = true;
}

function binaryStringABuffer(binario: string): ArrayBuffer {
  const buffer = new ArrayBuffer(binario.length);
  const vista = new Uint8Array(buffer);
  for (let i = 0; i < binario.length; i++) vista[i] = binario.charCodeAt(i) & 0xff;
  return buffer;
}

export interface CertificadoExtraido {
  claveCryptoKey: CryptoKey;
  certificadoBase64Der: string;
}

/**
 * Extrae la clave privada y el certificado de un archivo .p12 (PKCS#12) y convierte
 * la clave a un CryptoKey PKCS8 utilizable por xadesjs para firmar.
 */
export async function extraerCertificado(
  p12Base64: string,
  password: string,
): Promise<CertificadoExtraido> {
  inicializarMotor();

  let p12: forge.pkcs12.Pkcs12Pfx;
  try {
    const p12Der = forge.util.decode64(p12Base64);
    const p12Asn1 = forge.asn1.fromDer(p12Der);
    p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);
  } catch (e) {
    throw new Error(`No se pudo leer el archivo .p12 — revisar que el archivo/contraseña sean correctos: ${(e as Error).message}`);
  }

  const keyBags =
    p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] ??
    p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag];
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag];

  const privateKey = keyBags?.[0]?.key;
  const certificado = certBags?.[0]?.cert;
  if (!privateKey || !certificado) {
    throw new Error('El archivo .p12 no contiene una clave privada y un certificado válidos');
  }

  const pkcs8Der = forge.asn1
    .toDer(forge.pki.wrapRsaPrivateKey(forge.pki.privateKeyToAsn1(privateKey)))
    .getBytes();

  const claveCryptoKey = await xadesjs.Application.crypto.subtle.importKey(
    'pkcs8',
    binaryStringABuffer(pkcs8Der),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(certificado)).getBytes();
  const certificadoBase64Der = forge.util.encode64(certDer);

  return { claveCryptoKey, certificadoBase64Der };
}

/**
 * Firma el XML de la factura con XAdES-BES, enveloped (el <Signature> queda como
 * hijo del elemento raíz <factura>, referenciando todo el documento con URI="").
 */
export async function firmarXML(xmlSinFirmar: string, certificado: CertificadoExtraido): Promise<string> {
  inicializarMotor();

  const documento = xadesjs.Parse(xmlSinFirmar);
  const signedXml = new xadesjs.SignedXml(documento);

  const signature = await signedXml.Sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    certificado.claveCryptoKey,
    documento,
    {
      x509: [certificado.certificadoBase64Der],
      signingCertificate: certificado.certificadoBase64Der,
      references: [{ uri: '', transforms: ['enveloped', 'exc-c14n'], hash: 'SHA-256' }],
    },
  );

  const signatureXml = signature.GetXml();
  if (!signatureXml) throw new Error('xadesjs no devolvió el elemento <Signature> tras firmar');
  documento.documentElement.appendChild(signatureXml);

  // `documento` es en runtime un Document de @xmldom/xmldom (así lo devuelve
  // xadesjs.Parse), pero está tipado contra el `Document` global de lib.dom — los
  // dos mundos de tipos no unifican estructuralmente aunque sean el mismo objeto.
  return new XMLSerializer().serializeToString(documento as any);
}
