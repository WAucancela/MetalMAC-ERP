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
} from '../lib/services/woocommerce.service';

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
