import { z } from 'zod';

export const ROLES_USUARIO = ['GERENTE', 'BODEGUERO', 'PRODUCCION', 'CONTABILIDAD'] as const;

export const CrearUsuarioSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  rol: z.enum(ROLES_USUARIO),
});
export type CrearUsuarioInput = z.infer<typeof CrearUsuarioSchema>;

export const ActualizarUsuarioSchema = z.object({
  rol: z.enum(ROLES_USUARIO).optional(),
  activo: z.boolean().optional(),
});
export type ActualizarUsuarioInput = z.infer<typeof ActualizarUsuarioSchema>;
