import { z } from 'zod';

// El archivo .p12 en sí se valida aparte (instanceof File + tamaño), no acá.
export const SubirCertificadoSchema = z.object({
  password: z.string().min(1, 'La contraseña del certificado es obligatoria'),
});

export type SubirCertificadoInput = z.infer<typeof SubirCertificadoSchema>;
