/**
 * whatsapp-agente.service.ts — agente de ventas que atiende WhatsApp.
 *
 * Mismo principio que cotizacion-ia.service.ts (nunca inventa producto ni
 * precio — sólo usa lo que está en el catálogo real), pero acá es
 * conversacional: en vez de mandar el catálogo entero en el prompt, el
 * agente lo busca con la tool `buscar_productos` a medida que lo necesita —
 * mejor para un chat de varios turnos y no depende de que el catálogo entre
 * cómodo en el contexto.
 *
 * Cada request HTTP es stateless (serverless) — el historial de la
 * conversación se persiste en `whatsapp_conversaciones.historial` entre un
 * mensaje y el siguiente (ver la migración 20261021000000_whatsapp_agente.sql).
 *
 * Requiere ANTHROPIC_API_KEY (ya usada por cotizacion-ia.service.ts).
 */
import Anthropic from '@anthropic-ai/sdk';
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
// betaZodTool está tipado contra Zod v4 (`import * as z from 'zod/v4'` en su .d.ts) —
// el resto del proyecto usa zod@3.25 clásico (`from 'zod'`), que no es estructuralmente
// compatible con ese tipo. zod 3.25+ ya trae el core de v4 embebido bajo este subpath,
// así que no hace falta otra dependencia — solo importar distinto acá (mismo ajuste que
// cotizacion-ia.service.ts hace para zodOutputFormat).
import { z } from 'zod/v4';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { Database } from '@/types/supabase.types';
import type { HistorialMensaje } from '@/lib/services/whatsapp-historial';

const client = new Anthropic();

const IVA_ECUADOR = 0.15;
const DIAS_VIGENCIA_COTIZACION = 15;
// Tope de turnos guardados por conversación — basta para que el agente tenga
// contexto reciente sin que el historial (y el costo por mensaje) crezca sin
// límite en una conversación muy larga. No es compactación real: simplemente
// recorta los turnos más viejos.
const MAX_MENSAJES_HISTORIAL = 40;

const SYSTEM_PROMPT = `Sos el asistente de ventas de MetalMAC, un taller de metalmecánica en
Ecuador, atendiendo por WhatsApp. Hablás español neutro, en mensajes cortos
(es WhatsApp, no email) y con buena onda, pero profesional.

Tu única fuente de productos y precios es la tool "buscar_productos" — nunca
inventes un producto, un código o un precio que no haya devuelto esa tool, ni
redondees ni ajustes un precio.

Flujo típico:
1. El cliente describe lo que necesita. Si es ambiguo (no especifica cantidad,
   medida o variante), preguntá antes de buscar.
2. Usá "buscar_productos" para encontrar los productos del catálogo que
   correspondan. Si no encontrás nada razonable, decíselo al cliente en vez de
   ofrecer algo que no existe — alguien del equipo lo puede atender a mano.
3. Cuando el cliente confirme qué quiere y la cantidad de cada ítem, usá
   "crear_cotizacion" para dejar la cotización armada.
4. Contale el número de cotización y el total, y aclarale que el equipo la va
   a confirmar (plazos de entrega, forma de pago, etc. los define el staff —
   no los inventes vos).

No cierres ventas ni prometas fechas de entrega o condiciones de pago — tu
trabajo es tomar el pedido y dejarlo cotizado, no cerrarlo.`;

const buscarProductosTool = betaZodTool({
  name: 'buscar_productos',
  description:
    'Busca productos activos en el catálogo real de MetalMAC por nombre, código o descripción. Devuelve como mucho 8 resultados, con id, código, nombre, descripción, precio de venta y unidad de venta.',
  inputSchema: z.object({
    query: z.string().min(1).describe('Texto a buscar — nombre, código o parte de la descripción del producto'),
  }),
  run: async ({ query }) => {
    const { data, error } = await supabaseAdmin
      .from('productos')
      .select('id, codigo, nombre, descripcion, precio_venta, unidad_venta')
      .eq('activo', true)
      .or(`nombre.ilike.%${query}%,codigo.ilike.%${query}%,descripcion.ilike.%${query}%`)
      .order('nombre')
      .limit(8);
    if (error) throw error;

    if (!data || data.length === 0) {
      return 'Sin resultados — ningún producto activo del catálogo matchea esa búsqueda.';
    }
    return JSON.stringify(
      data.map((p) => ({
        id: p.id,
        codigo: p.codigo,
        nombre: p.nombre,
        descripcion: p.descripcion,
        precioVenta: Number(p.precio_venta),
        unidadVenta: p.unidad_venta,
      })),
    );
  },
});

interface ContextoCotizacion {
  telefono: string;
  nombreCliente: string;
  clienteId: string | null;
}

function crearCrearCotizacionTool(contexto: ContextoCotizacion) {
  return betaZodTool({
    name: 'crear_cotizacion',
    description:
      'Crea una cotización en BORRADOR con las líneas pedidas, usando SIEMPRE el id de producto devuelto por buscar_productos. El precio y la descripción se toman del catálogo (no del que mandes vos) — no hace falta mandarlos. Cantidades e ids que no correspondan a un producto activo quedan afuera y se reportan en "itemsNoEncontrados".',
    inputSchema: z.object({
      lineas: z
        .array(
          z.object({
            productoId: z.string().uuid().describe('id de producto devuelto por buscar_productos'),
            cantidad: z.number().positive(),
          }),
        )
        .min(1),
      notas: z.string().max(500).optional().describe('Nota corta para el staff (ej. detalles que mencionó el cliente)'),
    }),
    run: async ({ lineas, notas }) => {
      const ids = [...new Set(lineas.map((l) => l.productoId))];
      const { data: productos, error: productosError } = await supabaseAdmin
        .from('productos')
        .select('id, nombre, descripcion, precio_venta')
        .in('id', ids)
        .eq('activo', true);
      if (productosError) throw productosError;

      const productosPorId = new Map((productos ?? []).map((p) => [p.id, p]));

      const lineasValidas = lineas.filter((l) => productosPorId.has(l.productoId));
      const idsNoEncontrados = [...new Set(lineas.filter((l) => !productosPorId.has(l.productoId)).map((l) => l.productoId))];

      if (lineasValidas.length === 0) {
        return JSON.stringify({
          error: 'Ninguno de los productoId corresponde a un producto activo del catálogo — no se creó ninguna cotización.',
          itemsNoEncontrados: idsNoEncontrados,
        });
      }

      const lineasConSubtotal = lineasValidas.map((l) => {
        const producto = productosPorId.get(l.productoId)!;
        const precioUnitario = Number(producto.precio_venta);
        return {
          productoId: l.productoId,
          descripcion: producto.descripcion || producto.nombre,
          cantidad: l.cantidad,
          precioUnitario,
          subtotal: Math.round(l.cantidad * precioUnitario * 100) / 100,
        };
      });
      const subtotalSinIva = Math.round(lineasConSubtotal.reduce((acc, l) => acc + l.subtotal, 0) * 100) / 100;
      const iva = Math.round(subtotalSinIva * IVA_ECUADOR * 100) / 100;
      const total = Math.round((subtotalSinIva + iva) * 100) / 100;

      const hoy = new Date();
      const fechaEmision = hoy.toISOString().slice(0, 10);
      const fechaVencimiento = new Date(hoy.getTime() + DIAS_VIGENCIA_COTIZACION * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);

      // Mismo contador genérico que usa POST /api/cotizaciones (y OP-YYYY-NNNN /
      // PRY-YYYY-NNNN) — prefijo 'COT', ver counters_and_triggers.sql.
      const { data: secuencia, error: secError } = await supabaseAdmin.rpc('siguiente_secuencia_anual', {
        p_prefijo: 'COT',
        p_anio: hoy.getUTCFullYear(),
      });
      if (secError) throw secError;
      const numero = `COT-${hoy.getUTCFullYear()}-${String(secuencia).padStart(4, '0')}`;

      const { data: cotizacion, error } = await supabaseAdmin
        .from('cotizaciones')
        .insert({
          numero,
          cliente_id: contexto.clienteId,
          cliente_nombre: contexto.nombreCliente,
          cliente_whatsapp: contexto.telefono,
          fecha_emision: fechaEmision,
          fecha_vencimiento: fechaVencimiento,
          subtotal_sin_iva: subtotalSinIva,
          iva,
          total,
          notas: notas ?? '',
          estado: 'BORRADOR',
          creado_por: null,
          origen: 'WHATSAPP_BOT',
        })
        .select('id')
        .single();
      if (error) throw error;

      const { error: lineasError } = await supabaseAdmin.from('cotizacion_lineas').insert(
        lineasConSubtotal.map((l, orden) => ({
          cotizacion_id: cotizacion.id,
          orden,
          descripcion: l.descripcion,
          cantidad: l.cantidad,
          precio_unitario: l.precioUnitario,
          subtotal: l.subtotal,
          producto_id: l.productoId,
          material_id: null,
        })),
      );
      if (lineasError) throw lineasError;

      await supabaseAdmin
        .from('whatsapp_conversaciones')
        .update({ cotizacion_borrador_id: cotizacion.id })
        .eq('telefono', contexto.telefono);

      return JSON.stringify({
        numero,
        total,
        itemsNoEncontrados: idsNoEncontrados,
      });
    },
  });
}

async function resolverCliente(telefono: string, nombreContacto: string) {
  const { data: existente } = await supabaseAdmin
    .from('clientes')
    .select('id, razon_social')
    .eq('whatsapp', telefono)
    .limit(1)
    .maybeSingle();
  if (existente) return existente;

  const { data: creado, error } = await supabaseAdmin
    .from('clientes')
    .insert({
      razon_social: nombreContacto || telefono,
      whatsapp: telefono,
      telefono,
      creado_por: null,
    })
    .select('id, razon_social')
    .single();
  if (error) throw error;
  return creado;
}

type ConversacionRow = Database['public']['Tables']['whatsapp_conversaciones']['Row'];

async function cargarOCrearConversacion(telefono: string, nombreContacto: string): Promise<ConversacionRow> {
  const { data: existente } = await supabaseAdmin
    .from('whatsapp_conversaciones')
    .select('*')
    .eq('telefono', telefono)
    .maybeSingle();
  if (existente) return existente;

  const { data: creada, error } = await supabaseAdmin
    .from('whatsapp_conversaciones')
    .insert({ telefono, nombre_contacto: nombreContacto })
    .select('*')
    .single();
  if (error) throw error;
  return creada;
}

function extraerTexto(content: Anthropic.Beta.BetaMessage['content']): string {
  return content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
}


/**
 * Procesa un mensaje entrante de WhatsApp y devuelve el texto a responder.
 * No envía el mensaje — eso lo hace el caller (app/api/whatsapp/webhook) vía
 * whatsapp.service.enviarMensajeTexto, para mantener esta función testeable
 * sin golpear el Graph API de Meta.
 */
export async function procesarMensajeEntrante(input: {
  telefono: string;
  nombreContacto: string;
  texto: string;
}): Promise<string> {
  const { telefono, nombreContacto, texto } = input;

  const [conversacion, cliente] = await Promise.all([
    cargarOCrearConversacion(telefono, nombreContacto),
    resolverCliente(telefono, nombreContacto),
  ]);

  if (!conversacion.cliente_id && cliente) {
    await supabaseAdmin
      .from('whatsapp_conversaciones')
      .update({ cliente_id: cliente.id })
      .eq('telefono', telefono);
  }

  const historialPrevio = (conversacion.historial as unknown as HistorialMensaje[] | null) ?? [];
  const messages: HistorialMensaje[] = [...historialPrevio, { role: 'user', content: texto }];

  const crearCotizacionTool = crearCrearCotizacionTool({
    telefono,
    nombreCliente: cliente?.razon_social || nombreContacto || telefono,
    clienteId: cliente?.id ?? null,
  });

  const runner = client.beta.messages.toolRunner({
    // Haiku 5.5: para una tarea simple de alto volumen (buscar en el catálogo,
    // armar una cotización) alcanza de sobra y sale ~40x más barato que Opus —
    // importante arrancando, cuando el volumen de WhatsApp todavía no justifica
    // el costo de un modelo más grande. Si el taller empieza a recibir pedidos
    // más ambiguos/complejos y el bot responde mal, subir a 'claude-sonnet-5-5'
    // es cambiar sólo esta línea.
    model: 'claude-haiku-5-5',
    max_tokens: 4096,
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    output_config: { effort: 'low' },
    messages,
    tools: [buscarProductosTool, crearCotizacionTool],
    max_iterations: 8,
  });

  const finalMessage = await runner;
  const respuesta = extraerTexto(finalMessage.content) || 'Perdón, no pude procesar eso — ¿podés reformularlo?';

  const historialActualizado = (runner.params.messages as HistorialMensaje[]).slice(-MAX_MENSAJES_HISTORIAL);

  await supabaseAdmin
    .from('whatsapp_conversaciones')
    .update({
      historial: historialActualizado as unknown as Database['public']['Tables']['whatsapp_conversaciones']['Update']['historial'],
      nombre_contacto: nombreContacto || conversacion.nombre_contacto,
      actualizado_en: new Date().toISOString(),
    })
    .eq('telefono', telefono);

  return respuesta;
}
