/**
 * cotizacion-ia.service.ts
 *
 * Arma líneas de cotización a partir de un pedido en lenguaje natural del
 * cliente (texto pegado de WhatsApp, email, etc.), matcheando SOLO contra el
 * catálogo real de Productos activos — nunca inventa productos ni precios.
 * Lo que no matchea queda en `itemsSinMatch` para que el staff lo revise y
 * cargue a mano (como línea libre) si corresponde.
 *
 * Usa output estructurado (Zod) en vez de tool use: es una sola llamada, sin
 * loop — el catálogo completo se pasa como contexto porque para un taller
 * chico entra cómodo en el prompt; si el catálogo creciera mucho, esto
 * necesitaría pasar a una búsqueda (tool use) en vez de mandar todo de una.
 *
 * Requiere ANTHROPIC_API_KEY configurada en el entorno (Vercel → Settings →
 * Environment Variables) — sin eso, cada llamada falla con AuthenticationError.
 */

import Anthropic from '@anthropic-ai/sdk';
// El helper zodOutputFormat de la SDK está tipado contra Zod v4 (`import * as z from 'zod/v4'`
// en su .d.ts) — el resto del proyecto usa zod@3.25 clásico (`from 'zod'`), que no es
// estructuralmente compatible con ese tipo. zod 3.25+ ya trae el core de v4 embebido bajo
// este subpath, así que no hace falta otra dependencia — solo importar distinto acá.
import { z } from 'zod/v4';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

const client = new Anthropic();

const LineaSugeridaSchema = z.object({
  productoId: z.string(),
  descripcion: z.string(),
  cantidad: z.number().positive(),
  precioUnitario: z.number().nonnegative(),
});

const CotizacionIAOutputSchema = z.object({
  lineas: z.array(LineaSugeridaSchema),
  // Ítems que el cliente pidió pero no matchean ningún producto del catálogo
  // — el staff las carga a mano como línea libre si corresponde.
  itemsSinMatch: z.array(z.string()),
  // Borrador corto para el campo "Notas" de la cotización.
  notas: z.string(),
});

export type CotizacionIAOutput = z.infer<typeof CotizacionIAOutputSchema>;

export interface ProductoCatalogoIA {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  precioVenta: number;
  unidadVenta: string;
}

export async function generarLineasCotizacionIA(
  textoCliente: string,
  catalogo: ProductoCatalogoIA[],
): Promise<CotizacionIAOutput> {
  if (catalogo.length === 0) {
    return { lineas: [], itemsSinMatch: [textoCliente], notas: '' };
  }

  const catalogoTexto = catalogo
    .map((p) => `- id=${p.id} | ${p.codigo} | ${p.nombre} — ${p.descripcion || 'sin descripción'} | $${p.precioVenta.toFixed(2)}/${p.unidadVenta}`)
    .join('\n');

  const response = await client.messages.parse({
    model: 'claude-opus-5',
    max_tokens: 4096,
    system:
      'Sos el asistente de cotizaciones de MetalMAC, un taller de metalmecánica en Ecuador. ' +
      'Tu única fuente de productos y precios es el catálogo de abajo — nunca inventes un ' +
      'producto, un código o un precio que no esté ahí, ni redondees ni ajustes el precio dado.\n\n' +
      `CATÁLOGO ACTIVO:\n${catalogoTexto}\n\n` +
      'Tarea: el cliente escribió un pedido en lenguaje natural (puede venir de WhatsApp, email, ' +
      'o dictado a mano). Para cada ítem que pidió:\n' +
      '- Si matchea razonablemente con un producto del catálogo (por nombre, código o descripción), ' +
      'agregalo a "lineas" con su id y precioUnitario EXACTOS del catálogo, y la cantidad que pidió el cliente.\n' +
      '- Si no hay ningún producto del catálogo que se parezca a lo que pidió, NO inventes una línea — ' +
      'agregá una frase corta describiendo ese ítem (en base a lo que escribió el cliente) a "itemsSinMatch" en cambio.\n' +
      '- Si el cliente no especifica cantidad para un ítem, asumí 1.\n' +
      'Además escribí en "notas" un texto corto y profesional (2-4 líneas) para la propuesta, en ' +
      'español neutro, sin inventar plazos de entrega ni condiciones de pago que el cliente no mencionó.',
    messages: [{ role: 'user', content: textoCliente }],
    output_config: { format: zodOutputFormat(CotizacionIAOutputSchema) },
  });

  if (!response.parsed_output) {
    throw new Error('No se pudo interpretar el pedido — probá con otro texto o cargá las líneas a mano.');
  }

  return response.parsed_output;
}
