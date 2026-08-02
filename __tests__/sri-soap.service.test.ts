/**
 * __tests__/sri-soap.service.test.ts
 *
 * resolverAmbienteSRI/digitoAmbiente son puras. enviarRecepcion/consultarAutorizacion
 * mockean `fetch` con una respuesta SOAP sintética — prueban que el parseo funciona,
 * NO que el SRI real vaya a responder así (eso solo se confirma contra el ambiente
 * de pruebas real).
 */
import {
  resolverAmbienteSRI,
  digitoAmbiente,
  enviarRecepcion,
  consultarAutorizacion,
} from '../lib/services/sri-soap.service';

describe('resolverAmbienteSRI', () => {
  const original = process.env.SRI_AMBIENTE;
  afterEach(() => {
    process.env.SRI_AMBIENTE = original;
  });

  it('lanza si SRI_AMBIENTE no está seteado', () => {
    delete process.env.SRI_AMBIENTE;
    expect(() => resolverAmbienteSRI()).toThrow(/SRI_AMBIENTE/);
  });

  it('lanza si SRI_AMBIENTE tiene un valor inválido', () => {
    process.env.SRI_AMBIENTE = 'STAGING';
    expect(() => resolverAmbienteSRI()).toThrow(/SRI_AMBIENTE/);
  });

  it('acepta PRUEBAS', () => {
    process.env.SRI_AMBIENTE = 'PRUEBAS';
    expect(resolverAmbienteSRI()).toBe('PRUEBAS');
  });

  it('acepta PRODUCCION', () => {
    process.env.SRI_AMBIENTE = 'PRODUCCION';
    expect(resolverAmbienteSRI()).toBe('PRODUCCION');
  });
});

describe('digitoAmbiente', () => {
  it('mapea PRUEBAS a "1" y PRODUCCION a "2"', () => {
    expect(digitoAmbiente('PRUEBAS')).toBe('1');
    expect(digitoAmbiente('PRODUCCION')).toBe('2');
  });
});

describe('enviarRecepcion (fetch mockeado)', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('parsea una respuesta RECIBIDA', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => `<?xml version="1.0"?>
        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
          <soap:Body>
            <ns2:validarComprobanteResponse xmlns:ns2="http://ec.gob.sri.ws.recepcion">
              <RespuestaRecepcionComprobante><estado>RECIBIDA</estado></RespuestaRecepcionComprobante>
            </ns2:validarComprobanteResponse>
          </soap:Body>
        </soap:Envelope>`,
    }) as any;

    const respuesta = await enviarRecepcion('QUlNQXNlIGVuIGJhc2U2NA==', 'PRUEBAS');
    expect(respuesta.estado).toBe('RECIBIDA');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('celcer.sri.gob.ec'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('lanza un error legible si el SRI responde con un HTTP de error', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    }) as any;

    await expect(enviarRecepcion('x', 'PRUEBAS')).rejects.toThrow(/HTTP 500/);
  });
});

describe('consultarAutorizacion (fetch mockeado)', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('parsea una respuesta AUTORIZADO y apunta al endpoint de producción cuando corresponde', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => `<?xml version="1.0"?>
        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
          <soap:Body>
            <ns2:autorizacionComprobanteResponse xmlns:ns2="http://ec.gob.sri.ws.autorizacion">
              <RespuestaAutorizacionComprobante>
                <autorizaciones>
                  <autorizacion>
                    <estado>AUTORIZADO</estado>
                    <numeroAutorizacion>1234567890</numeroAutorizacion>
                  </autorizacion>
                </autorizaciones>
              </RespuestaAutorizacionComprobante>
            </ns2:autorizacionComprobanteResponse>
          </soap:Body>
        </soap:Envelope>`,
    }) as any;

    const respuesta = await consultarAutorizacion('0'.repeat(49), 'PRODUCCION');
    expect(respuesta.estado).toBe('AUTORIZADO');
    expect(respuesta.numeroAutorizacion).toBe('1234567890');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('cel.sri.gob.ec'),
      expect.anything(),
    );
  });
});
