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
  // Código de establecimiento y punto de emisión ya registrados ante el SRI
  // (ej. "001", "100") — las facturas de venta nuevas se crean con esto por
  // default, para que "Emitir electrónicamente" continúe la serie real en
  // vez de arrancar una serie 001-001 paralela que nadie registró.
  establecimiento: z.string().regex(/^\d{3}$/, 'Deben ser 3 dígitos, ej. 001'),
  puntoEmision: z.string().regex(/^\d{3}$/, 'Deben ser 3 dígitos, ej. 001'),
  resendFromEmail: z.string().email('Email inválido'),
  // Vacío/omitido = no cambiar la API key que ya había guardada.
  resendApiKey: z.string().optional(),
});

export type ConfiguracionSRIInput = z.infer<typeof ConfiguracionSRISchema>;
