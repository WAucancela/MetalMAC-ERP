/**
 * Tests unitarios para woocommerce.service.ts
 *
 * - verificarFirmaWebhook: firma válida, inválida, header ausente
 * - resolverProductoPorSku: match exacto, sin match, case-insensitive
 * - calcularLineasAInsertar: excluye líneas ya convertidas, conserva las nuevas
 *
 * NO requiere Supabase — el servicio no hace I/O.
 */
import { createHmac } from 'node:crypto';
import {
  verificarFirmaWebhook,
  resolverProductoPorSku,
  calcularLineasAInsertar,
  construirPayloadProductoWC,
  puedePublicarseEnTienda,
  parsearUrlsImagenes,
} from '../lib/services/woocommerce.service';
import type { Producto } from '../types/metalmac.types';

// ─────────────────────────────────────────────
// verificarFirmaWebhook
// ─────────────────────────────────────────────

describe('verificarFirmaWebhook', () => {
  const secret = 'un-secreto-de-prueba';
  const rawBody = JSON.stringify({ id: 123, status: 'processing' });

  function firmar(body: string, s: string): string {
    return createHmac('sha256', s).update(body, 'utf8').digest('base64');
  }

  it('acepta una firma válida', () => {
    const firma = firmar(rawBody, secret);
    expect(verificarFirmaWebhook(rawBody, firma, secret)).toBe(true);
  });

  it('rechaza una firma calculada con otro secreto', () => {
    const firma = firmar(rawBody, 'otro-secreto');
    expect(verificarFirmaWebhook(rawBody, firma, secret)).toBe(false);
  });

  it('rechaza una firma de otro body (payload alterado)', () => {
    const firma = firmar(rawBody, secret);
    const otroBody = JSON.stringify({ id: 123, status: 'cancelled' });
    expect(verificarFirmaWebhook(otroBody, firma, secret)).toBe(false);
  });

  it('rechaza si no hay header de firma', () => {
    expect(verificarFirmaWebhook(rawBody, null, secret)).toBe(false);
  });

  it('rechaza si el secreto está vacío', () => {
    const firma = firmar(rawBody, secret);
    expect(verificarFirmaWebhook(rawBody, firma, '')).toBe(false);
  });

  it('rechaza una firma con longitud distinta sin lanzar excepción', () => {
    expect(verificarFirmaWebhook(rawBody, 'firma-corta', secret)).toBe(false);
  });
});

// ─────────────────────────────────────────────
// resolverProductoPorSku
// ─────────────────────────────────────────────

describe('resolverProductoPorSku', () => {
  const productos = [
    { id: 'p1', codigo: 'MAC-001' },
    { id: 'p2', codigo: 'MAC-002' },
  ];

  it('resuelve por coincidencia exacta', () => {
    expect(resolverProductoPorSku('MAC-001', productos)).toBe('p1');
  });

  it('resuelve sin importar mayúsculas/minúsculas', () => {
    expect(resolverProductoPorSku('mac-002', productos)).toBe('p2');
  });

  it('retorna null si no hay coincidencia', () => {
    expect(resolverProductoPorSku('MAC-999', productos)).toBeNull();
  });

  it('retorna null si el SKU viene vacío', () => {
    expect(resolverProductoPorSku('', productos)).toBeNull();
  });
});

// ─────────────────────────────────────────────
// calcularLineasAInsertar
// ─────────────────────────────────────────────

describe('calcularLineasAInsertar', () => {
  const lineItems = [
    { id: 1, sku: 'MAC-001', name: 'Reja modelo A', quantity: 2 },
    { id: 2, sku: 'MAC-002', name: 'Puerta modelo B', quantity: 1 },
  ];

  it('conserva todas las líneas si ninguna fue convertida', () => {
    expect(calcularLineasAInsertar(lineItems, [])).toEqual(lineItems);
  });

  it('excluye las líneas ya convertidas en OP', () => {
    const resultado = calcularLineasAInsertar(lineItems, [{ wcLineItemId: 1 }]);
    expect(resultado).toEqual([lineItems[1]]);
  });

  it('excluye todas si todas fueron convertidas', () => {
    const resultado = calcularLineasAInsertar(lineItems, [
      { wcLineItemId: 1 },
      { wcLineItemId: 2 },
    ]);
    expect(resultado).toEqual([]);
  });
});

// ─────────────────────────────────────────────
// construirPayloadProductoWC / puedePublicarseEnTienda
// ─────────────────────────────────────────────

describe('construirPayloadProductoWC', () => {
  const productoBase: Producto = {
    id: 'p1',
    codigo: 'MAC-001',
    nombre: 'Poste metálico 6m',
    descripcion: 'Poste galvanizado',
    tipo: 'PRODUCTO_TERMINADO',
    unidadVenta: 'UNIDAD',
    precioVenta: 125.5,
    activo: true,
    imagenUrls: '',
    wcProductId: null,
    wcSincronizadoEn: null,
  };

  it('mapea los campos básicos del producto', () => {
    const payload = construirPayloadProductoWC(productoBase);
    expect(payload.name).toBe('Poste metálico 6m');
    expect(payload.sku).toBe('MAC-001');
    expect(payload.description).toBe('Poste galvanizado');
    expect(payload.regular_price).toBe('125.50');
  });

  it('sin stock de producto terminado en el ERP: siempre "disponible", sin manejar cantidad', () => {
    const payload = construirPayloadProductoWC(productoBase);
    expect(payload.manage_stock).toBe(false);
    expect(payload.stock_status).toBe('instock');
  });

  it('publica como borrador si no hay imagen', () => {
    const payload = construirPayloadProductoWC(productoBase);
    expect(payload.status).toBe('draft');
    expect(payload.images).toBeUndefined();
  });

  it('publica visible y manda la imagen si hay una sola URL', () => {
    const payload = construirPayloadProductoWC({
      ...productoBase,
      imagenUrls: 'https://tallermac.com/foto.jpg',
    });
    expect(payload.status).toBe('publish');
    expect(payload.images).toEqual([{ src: 'https://tallermac.com/foto.jpg' }]);
  });

  it('manda todas las URLs cuando hay varias, en el mismo orden', () => {
    const payload = construirPayloadProductoWC({
      ...productoBase,
      imagenUrls: 'https://tallermac.com/foto-1.jpg\nhttps://tallermac.com/foto-2.jpg',
    });
    expect(payload.status).toBe('publish');
    expect(payload.images).toEqual([
      { src: 'https://tallermac.com/foto-1.jpg' },
      { src: 'https://tallermac.com/foto-2.jpg' },
    ]);
  });

  describe('parsearUrlsImagenes', () => {
    it('separa por línea y descarta las líneas en blanco', () => {
      expect(parsearUrlsImagenes('https://a.com/1.jpg\n\nhttps://a.com/2.jpg\n')).toEqual([
        'https://a.com/1.jpg',
        'https://a.com/2.jpg',
      ]);
    });

    it('recorta espacios alrededor de cada URL', () => {
      expect(parsearUrlsImagenes('  https://a.com/1.jpg  ')).toEqual(['https://a.com/1.jpg']);
    });

    it('retorna vacío para un texto vacío o solo espacios/saltos de línea', () => {
      expect(parsearUrlsImagenes('')).toEqual([]);
      expect(parsearUrlsImagenes('\n  \n')).toEqual([]);
    });
  });

  describe('puedePublicarseEnTienda', () => {
    it('permite un producto terminado y activo', () => {
      expect(puedePublicarseEnTienda({ tipo: 'PRODUCTO_TERMINADO', activo: true })).toBe(true);
    });

    it('rechaza un semielaborado aunque esté activo', () => {
      expect(puedePublicarseEnTienda({ tipo: 'SEMIELABORADO', activo: true })).toBe(false);
    });

    it('rechaza un producto terminado inactivo', () => {
      expect(puedePublicarseEnTienda({ tipo: 'PRODUCTO_TERMINADO', activo: false })).toBe(false);
    });
  });
});
