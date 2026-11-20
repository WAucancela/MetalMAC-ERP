/**
 * Tests unitarios para whatsapp-historial.ts
 *
 * NO requiere Supabase ni el SDK de Anthropic en runtime — sólo usa el tipo
 * (import type), así que esto no instancia ningún cliente.
 */
import { interpretarHistorial, ultimoMensajeDeHistorial, type HistorialMensaje } from '../lib/services/whatsapp-historial';

describe('interpretarHistorial', () => {
  it('convierte un turno de texto del cliente', () => {
    const historial: HistorialMensaje[] = [{ role: 'user', content: 'Hola, necesito 10 pernos M8' }];
    expect(interpretarHistorial(historial)).toEqual([
      { rol: 'CLIENTE', texto: 'Hola, necesito 10 pernos M8' },
    ]);
  });

  it('convierte un bloque de texto del agente', () => {
    const historial: HistorialMensaje[] = [
      { role: 'assistant', content: [{ type: 'text', text: '¡Hola! ¿Cuántos necesitás?' }] },
    ];
    expect(interpretarHistorial(historial)).toEqual([
      { rol: 'AGENTE', texto: '¡Hola! ¿Cuántos necesitás?' },
    ]);
  });

  it('describe un tool_use de buscar_productos como nota de sistema', () => {
    const historial: HistorialMensaje[] = [
      {
        role: 'assistant',
        content: [{ type: 'tool_use', id: 'tu_1', name: 'buscar_productos', input: { query: 'pernos M8' } }],
      },
    ];
    expect(interpretarHistorial(historial)).toEqual([
      { rol: 'SISTEMA', texto: '🔍 Buscó en el catálogo: "pernos M8"' },
    ]);
  });

  it('describe un tool_use de crear_cotizacion con la cantidad de líneas', () => {
    const historial: HistorialMensaje[] = [
      {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'tu_2',
            name: 'crear_cotizacion',
            input: { lineas: [{ productoId: 'a', cantidad: 1 }, { productoId: 'b', cantidad: 2 }] },
          },
        ],
      },
    ];
    expect(interpretarHistorial(historial)).toEqual([
      { rol: 'SISTEMA', texto: '🧾 Armó una cotización con 2 línea(s)' },
    ]);
  });

  it('omite los bloques tool_result (ya representados por el tool_use que los generó)', () => {
    const historial: HistorialMensaje[] = [
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu_1', content: '[]' }] },
    ];
    expect(interpretarHistorial(historial)).toEqual([]);
  });

  it('reconstruye una conversación completa en orden', () => {
    const historial: HistorialMensaje[] = [
      { role: 'user', content: 'Necesito 5 pernos M8' },
      {
        role: 'assistant',
        content: [{ type: 'tool_use', id: 'tu_1', name: 'buscar_productos', input: { query: 'pernos M8' } }],
      },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu_1', content: '[]' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'No tengo ese producto en el catálogo, te derivo con el equipo.' }] },
    ];
    expect(interpretarHistorial(historial)).toEqual([
      { rol: 'CLIENTE', texto: 'Necesito 5 pernos M8' },
      { rol: 'SISTEMA', texto: '🔍 Buscó en el catálogo: "pernos M8"' },
      { rol: 'AGENTE', texto: 'No tengo ese producto en el catálogo, te derivo con el equipo.' },
    ]);
  });
});

describe('ultimoMensajeDeHistorial', () => {
  it('devuelve el último texto real, ignorando notas de sistema', () => {
    const historial: HistorialMensaje[] = [
      { role: 'user', content: 'Necesito 5 pernos M8' },
      {
        role: 'assistant',
        content: [{ type: 'tool_use', id: 'tu_1', name: 'buscar_productos', input: { query: 'pernos M8' } }],
      },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu_1', content: '[]' }] },
    ];
    expect(ultimoMensajeDeHistorial(historial)).toBe('Necesito 5 pernos M8');
  });

  it('devuelve cadena vacía si no hay historial', () => {
    expect(ultimoMensajeDeHistorial([])).toBe('');
  });
});
