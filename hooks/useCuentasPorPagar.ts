/**
 * useCuentasPorPagar — listado de facturas de compra con saldo pendiente +
 * registro de pagos.
 */

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import type { BucketAntiguedad } from '@/lib/services/finanzas.service';
import type { RegistrarPagoInput } from '@/lib/validations/finanzas.schema';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export interface CuentaPorPagar {
  id: string;
  numeroFactura: string;
  proveedorNombre: string | null;
  fechaEmision: string;
  fechaVencimiento: string | null;
  total: number;
  saldo: number;
  antiguedad: BucketAntiguedad;
}

export function useCuentasPorPagar() {
  const { token } = useAuth();
  return useQuery<CuentaPorPagar[]>({
    queryKey: ['cuentas-por-pagar'],
    queryFn: async () => {
      const res = await fetch('/api/contabilidad/cuentas-por-pagar', { headers: authHeaders(token ?? '') });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al cargar cuentas por pagar');
      return json.data;
    },
    enabled: !!token,
  });
}

export function useRegistrarPagoCompra(facturaCompraId: string) {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: RegistrarPagoInput) => {
      const res = await fetch(`/api/contabilidad/facturas/${facturaCompraId}/pagos`, {
        method: 'POST',
        headers: { ...authHeaders(token ?? ''), 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al registrar el pago');
      return json.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cuentas-por-pagar'] });
      qc.invalidateQueries({ queryKey: ['pagos-compra', facturaCompraId] });
      qc.invalidateQueries({ queryKey: ['bancos'] });
    },
  });
}
