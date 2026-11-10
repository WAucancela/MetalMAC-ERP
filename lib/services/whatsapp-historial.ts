/**
 * whatsapp-historial.ts — convierte el historial crudo de una conversación de
 * WhatsApp (turnos del SDK de Anthropic, con bloques de texto/tool_use/
 * tool_result) en una lista simple para mostrar en el dashboard, sin que la
 * UI tenga que conocer la forma de esos content blocks.
 *
 * Sin I/O ni dependencia del cliente de Anthropic — sólo el tipo, vía
 * `import type` (se borra en compilación, no arrastra el paquete en runtime).
 * A propósito separado de whatsapp-agente.service.ts (que sí instancia
 * `new Anthropic()` a nivel de módulo): mappers.ts importa este archivo desde
 * casi cualquier API route, y no puede arrastrar esa dependencia pesada sólo
 * para listar conversaciones.
 */
import type Anthropic from '@anthropic-ai/sdk';
import type { MensajeConversacionWhatsApp } from '@/types/metalmac.types';

export type HistorialMensaje = Anthropic.Beta.BetaMessageParam;

function describirToolUse(name: string, input: unknown): string {
  if (name === 'buscar_productos' && typeof input === 'object' && input !== null && 'query' in input) {
    return `🔍 Buscó en el catálogo: "${String((input as { query: unknown }).query)}"`;
  }
  if (name === 'crear_cotizacion' && typeof input === 'object' && input !== null && 'lineas' in input) {
    const lineas = (input as { lineas: unknown[] }).lineas;
    const cantidad = Array.isArray(lineas) ? lineas.length : 0;
    return `🧾 Armó una cotización con ${cantidad} línea(s)`;
  }
  return `Ejecutó la herramienta "${name}"`;
}

/**
 * Los bloques `tool_result` (turnos role: 'user' que no son texto del
 * cliente, sino la respuesta de una tool) se omiten del timeline a propósito:
 * ya quedan representados por el `tool_use` que los generó, y mostrar el
 * JSON crudo de vuelta no aporta nada a alguien del staff mirando la
 * conversación.
 */
export function interpretarHistorial(historial: HistorialMensaje[]): MensajeConversacionWhatsApp[] {
  const mensajes: MensajeConversacionWhatsApp[] = [];

  for (const mensaje of historial) {
    if (typeof mensaje.content === 'string') {
      // Sólo pasa en el turno inicial que agrega procesarMensajeEntrante — el texto tal cual lo escribió el cliente.
      if (mensaje.role === 'user' && mensaje.content.trim()) {
        mensajes.push({ rol: 'CLIENTE', texto: mensaje.content.trim() });
      }
      continue;
    }
    if (!Array.isArray(mensaje.content)) continue;

    for (const block of mensaje.content) {
      if (block.type === 'text' && block.text.trim()) {
        mensajes.push({ rol: mensaje.role === 'user' ? 'CLIENTE' : 'AGENTE', texto: block.text.trim() });
      } else if (block.type === 'tool_use') {
        mensajes.push({ rol: 'SISTEMA', texto: describirToolUse(block.name, block.input) });
      }
    }
  }

  return mensajes;
}

/** Último texto de cliente o agente (ignora las notas de sistema) — para la vista previa en la lista de conversaciones. */
export function ultimoMensajeDeHistorial(historial: HistorialMensaje[]): string {
  const mensajes = interpretarHistorial(historial);
  const ultimoConTexto = [...mensajes].reverse().find((m) => m.rol !== 'SISTEMA');
  return (ultimoConTexto ?? mensajes.at(-1))?.texto ?? '';
}
