import { z } from 'zod';

export const ConfiguracionSRISchema = z.object({
  ambiente: z.enum(['PRUEBAS', 'PRODUCCION']),
  emisorRuc: z
    .string()
    .length(13, 'El RUC debe tener exactamente 13 dígitos')
    .regex(/^\d+$/, 'El RUC solo puede contener dígitos'),
  emisorRazonSocial: z.string().min(2).max(300),
  emisorNombreComercial: z.string().min(2).max(300),
  emisorDirMatriz: z.string().min(5).max(300),
  emisorDirEstablecimiento: z.string().min(5).max(300),
  emisorObligadoContabilidad: z.enum(['SI', 'NO']),
  resendFromEmail: z.string().email('Email inválido'),
  // Vacío/omitido = no cambiar la API key que ya había guardada.
  resendApiKey: z.string().optional(),
});

export type ConfiguracionSRIInput = z.infer<typeof ConfiguracionSRISchema>;
