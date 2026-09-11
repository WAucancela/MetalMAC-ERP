/**
 * clientes.schema.ts — validación de entrada para /api/clientes.
 */
import { z } from 'zod';

export const ClienteSchema = z.object({
  tipoIdentificacion: z.enum(['RUC', 'CEDULA', 'PASAPORTE']).nullable().default(null),
  // Sin regex fijo a propósito: RUC (13), cédula (10) o pasaporte (alfanumérico)
  // tienen formatos distintos — se deja como texto libre, validado solo por longitud.
  identificacion: z.string().max(20).nullable().default(null),
  razonSocial: z.string().min(2).max(300),
  nombreComercial: z.string().max(200).default(''),
  email: z.string().email().or(z.literal('')).default(''),
  telefono: z.string().max(20).default(''),
  whatsapp: z.string().max(20).default(''),
  direccion: z.string().max(300).default(''),
  ciudad: z.string().max(100).default(''),
  notas: z.string().max(1000).default(''),
  activo: z.boolean().default(true),
});

export type ClienteInput = z.infer<typeof ClienteSchema>;

export const ClientesQuerySchema = z.object({
  activo: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  q: z.string().max(200).optional(),
  // 500 cubre el uso de "catálogo completo" (selects/combobox) sin paginar;
  // /clientes pagina de verdad con `page` + un `limit` menor.
  limit: z.coerce.number().int().min(1).max(500).default(50),
  page: z.coerce.number().int().min(1).default(1),
});

export type ClientesQuery = z.infer<typeof ClientesQuerySchema>;

export const InteraccionSchema = z.object({
  tipo: z.enum(['LLAMADA', 'EMAIL', 'REUNION', 'NOTA']),
  descripcion: z.string().min(1).max(2000),
});

export type InteraccionInput = z.infer<typeof InteraccionSchema>;
