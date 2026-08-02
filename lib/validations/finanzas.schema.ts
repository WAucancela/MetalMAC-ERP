import { z } from 'zod';

export const RegistrarPagoSchema = z.object({
  monto:            z.number().positive('El monto debe ser mayor a 0'),
  fecha:            z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato ISO: YYYY-MM-DD'),
  metodoPago:       z.string().max(100).optional(),
  referencia:       z.string().max(200).optional(),
  cuentaBancariaId: z.string().uuid().nullable().optional(),
  notas:            z.string().max(500).optional(),
});

export type RegistrarPagoInput = z.infer<typeof RegistrarPagoSchema>;
