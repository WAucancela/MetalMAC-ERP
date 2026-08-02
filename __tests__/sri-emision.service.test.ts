/**
 * __tests__/sri-emision.service.test.ts
 * Tests de lib/services/sri-emision.service.ts — todo puro, sin red ni firma.
 */

import {
  generarClaveAcceso,
  generarCodigoNumerico,
  generarXMLFactura,
  parsearRespuestaRecepcion,
  parsearRespuestaAutorizacion,
  type EmisorConfig,
} from '../lib/services/sri-emision.service';
import { validarClaveAcceso, parsearXML } from '../lib/services/sri.service';

const emisor: EmisorConfig = {
  ruc: '0994008740001',
  razonSocial: 'METALMAC CIA. LTDA.',
  nombreComercial: 'MetalMAC',
  dirMatriz: 'Av. Principal 123 y Secundaria, Guayaquil',
  dirEstablecimiento: 'Av. Principal 123 y Secundaria, Guayaquil',
  obligadoContabilidad: 'SI',
};

describe('generarClaveAcceso', () => {
  const base = {
    fechaEmisionISO: '2026-08-02',
    rucEmisor: '0994008740001',
    ambiente: '1' as const,
    establecimiento: '001',
    puntoEmision: '001',
    secuencial: 123,
    codigoNumerico: '12345678',
  };

  it('genera una clave de 49 dígitos que pasa validarClaveAcceso', () => {
    const clave = generarClaveAcceso(base);
    expect(clave).toHaveLength(49);
    expect(clave).toMatch(/^\d{49}$/);
    const parsed = validarClaveAcceso(clave);
    expect(parsed.tipoComprobante).toBe('01');
    expect(parsed.ambiente).toBe('1');
    expect(parsed.rucEmisor).toBe(base.rucEmisor);
    expect(parsed.secuencial).toBe('000000123');
    expect(parsed.serie).toBe('001001');
  });

  it('refleja el ambiente de producción cuando se pide', () => {
    const clave = generarClaveAcceso({ ...base, ambiente: '2' });
    expect(validarClaveAcceso(clave).ambiente).toBe('2');
  });

  it('rellena el secuencial a 9 dígitos', () => {
    const clave = generarClaveAcceso({ ...base, secuencial: 7 });
    expect(validarClaveAcceso(clave).secuencial).toBe('000000007');
  });

  it('rechaza una fecha sin el formato YYYY-MM-DD', () => {
    expect(() => generarClaveAcceso({ ...base, fechaEmisionISO: '20260802' })).toThrow();
  });
});

describe('generarCodigoNumerico', () => {
  it('siempre devuelve 8 dígitos', () => {
    for (let i = 0; i < 20; i++) {
      expect(generarCodigoNumerico()).toMatch(/^\d{8}$/);
    }
  });
});

describe('generarXMLFactura — round trip con parsearXML', () => {
  const facturaBase = {
    clienteNombre: 'Cliente de Prueba S.A.',
    clienteRuc: '0912345678',
    fechaEmision: '2026-08-02',
    subtotalSinIva: 300,
    iva: 45,
    total: 345,
  };
  const lineas = [
    { descripcion: 'Reja perimetral 3x2m', cantidad: 2, precioUnitario: 150, subtotal: 300, ordenProduccionId: null },
  ];

  it('rechaza generar el XML de una factura sin líneas', () => {
    expect(() =>
      generarXMLFactura(facturaBase, [], '0'.repeat(49), '001', '001', 1, emisor),
    ).toThrow(/sin líneas/);
  });

  it('genera un XML que parsearXML puede volver a leer con los mismos datos', () => {
    const claveAcceso = generarClaveAcceso({
      fechaEmisionISO: facturaBase.fechaEmision,
      rucEmisor: emisor.ruc,
      ambiente: '1',
      establecimiento: '001',
      puntoEmision: '001',
      secuencial: 42,
      codigoNumerico: generarCodigoNumerico(),
    });

    const xml = generarXMLFactura(facturaBase, lineas, claveAcceso, '001', '001', 42, emisor);
    const parsed = parsearXML(xml);

    expect(parsed.claveAcceso).toBe(claveAcceso);
    expect(parsed.numeroFactura).toBe('001-001-000000042');
    expect(parsed.rucEmisor).toBe(emisor.ruc);
    expect(parsed.razonSocialEmisor).toBe(emisor.razonSocial);
    expect(parsed.fechaEmision).toBe('02/08/2026');
    expect(parsed.subtotalSinIva).toBeCloseTo(300, 2);
    expect(parsed.totalIva).toBeCloseTo(45, 2);
    expect(parsed.importeTotal).toBeCloseTo(345, 2);
    expect(parsed.lineas).toHaveLength(1);
    expect(parsed.lineas[0].descripcion).toBe('Reja perimetral 3x2m');
    expect(parsed.lineas[0].cantidad).toBe(2);
    expect(parsed.lineas[0].precioUnitario).toBeCloseTo(150, 2);
  });

  it('escapa caracteres especiales en la descripción del cliente/línea', () => {
    const claveAcceso = generarClaveAcceso({
      fechaEmisionISO: facturaBase.fechaEmision,
      rucEmisor: emisor.ruc,
      ambiente: '1',
      establecimiento: '001',
      puntoEmision: '001',
      secuencial: 1,
      codigoNumerico: generarCodigoNumerico(),
    });
    const lineasConCaracteres = [
      { descripcion: 'Reja & Portón "especial" <2m>', cantidad: 1, precioUnitario: 100, subtotal: 100, ordenProduccionId: null },
    ];
    const xml = generarXMLFactura(
      { ...facturaBase, clienteNombre: 'Cliente & Cía. S.A.' },
      lineasConCaracteres,
      claveAcceso,
      '001',
      '001',
      1,
      emisor,
    );
    const parsed = parsearXML(xml);
    expect(parsed.lineas[0].descripcion).toBe('Reja & Portón "especial" <2m>');
  });
});

describe('parsearRespuestaRecepcion', () => {
  it('interpreta una recepción exitosa (RECIBIDA)', () => {
    const r = parsearRespuestaRecepcion({
      RespuestaRecepcionComprobante: { estado: 'RECIBIDA' },
    });
    expect(r.estado).toBe('RECIBIDA');
    expect(r.mensajes).toEqual([]);
  });

  it('interpreta una recepción rechazada (DEVUELTA) con mensajes', () => {
    const r = parsearRespuestaRecepcion({
      RespuestaRecepcionComprobante: {
        estado: 'DEVUELTA',
        comprobantes: {
          comprobante: {
            mensajes: {
              mensaje: { identificador: '35', mensaje: 'FIRMA INVALIDA', informacionAdicional: 'el certificado no es válido' },
            },
          },
        },
      },
    });
    expect(r.estado).toBe('DEVUELTA');
    expect(r.mensajes[0]).toContain('FIRMA INVALIDA');
    expect(r.mensajes[0]).toContain('el certificado no es válido');
  });

  it('normaliza múltiples mensajes a un array', () => {
    const r = parsearRespuestaRecepcion({
      RespuestaRecepcionComprobante: {
        estado: 'DEVUELTA',
        comprobantes: {
          comprobante: {
            mensajes: {
              mensaje: [
                { identificador: '35', mensaje: 'ERROR 1' },
                { identificador: '43', mensaje: 'ERROR 2' },
              ],
            },
          },
        },
      },
    });
    expect(r.mensajes).toHaveLength(2);
  });
});

describe('parsearRespuestaAutorizacion', () => {
  it('interpreta un comprobante autorizado', () => {
    const r = parsearRespuestaAutorizacion({
      RespuestaAutorizacionComprobante: {
        autorizaciones: {
          autorizacion: {
            estado: 'AUTORIZADO',
            numeroAutorizacion: '1234567890',
            fechaAutorizacion: '2026-08-02T10:00:00',
          },
        },
      },
    });
    expect(r.estado).toBe('AUTORIZADO');
    expect(r.numeroAutorizacion).toBe('1234567890');
  });

  it('interpreta un comprobante no autorizado con mensajes', () => {
    const r = parsearRespuestaAutorizacion({
      RespuestaAutorizacionComprobante: {
        autorizaciones: {
          autorizacion: {
            estado: 'NO AUTORIZADO',
            mensajes: { mensaje: { identificador: '70', mensaje: 'CLAVE DE ACCESO REGISTRADA' } },
          },
        },
      },
    });
    expect(r.estado).toBe('NO_AUTORIZADO');
    expect(r.numeroAutorizacion).toBeNull();
    expect(r.mensajes[0]).toContain('CLAVE DE ACCESO REGISTRADA');
  });

  it('interpreta una autorización todavía en proceso', () => {
    const r = parsearRespuestaAutorizacion({});
    expect(r.estado).toBe('EN_PROCESO');
  });
});
