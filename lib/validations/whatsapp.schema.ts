import { z } from 'zod';

// Forma del payload de webhook de WhatsApp Cloud API (Meta) — sólo lo que
// usamos. Un mismo webhook llega tanto para mensajes nuevos como para
// actualizaciones de estado (entregado/leído, "statuses"), por eso casi todo
// es opcional: un payload de "statuses" no trae `messages`.
const WhatsAppTextMessageSchema = z.object({
  from: z.string(),
  id: z.string(),
  timestamp: z.string(),
  type: z.string(),
  text: z.object({ body: z.string() }).optional(),
});

const WhatsAppContactSchema = z.object({
  wa_id: z.string(),
  profile: z.object({ name: z.string().optional() }).optional(),
});

const WhatsAppValueSchema = z.object({
  messaging_product: z.literal('whatsapp'),
  metadata: z.object({
    display_phone_number: z.string().optional(),
    phone_number_id: z.string(),
  }),
  contacts: z.array(WhatsAppContactSchema).optional(),
  messages: z.array(WhatsAppTextMessageSchema).optional(),
});

const WhatsAppChangeSchema = z.object({
  field: z.string(),
  value: WhatsAppValueSchema,
});

const WhatsAppEntrySchema = z.object({
  id: z.string(),
  changes: z.array(WhatsAppChangeSchema),
});

export const WhatsAppWebhookPayloadSchema = z.object({
  object: z.string(),
  entry: z.array(WhatsAppEntrySchema),
});

export type WhatsAppWebhookPayload = z.infer<typeof WhatsAppWebhookPayloadSchema>;

export const WhatsAppConversacionesQuerySchema = z.object({
  estado: z.enum(['ACTIVA', 'CERRADA']).optional(),
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  page: z.coerce.number().int().min(1).default(1),
});
export type WhatsAppConversacionesQuery = z.infer<typeof WhatsAppConversacionesQuerySchema>;

export const WhatsAppWebhookVerifySchema = z.object({
  'hub.mode': z.literal('subscribe'),
  'hub.verify_token': z.string(),
  'hub.challenge': z.string(),
});
