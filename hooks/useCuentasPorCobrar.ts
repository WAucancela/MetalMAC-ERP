/**
 * useCuentasPorCobrar — listado de facturas de venta con saldo pendiente +
 * registro de cobros.
 */

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import type { BucketAntiguedad } from '@/lib/services/finanzas.service';
import type { RegistrarPagoInput } from '@/lib/validations/finanzas.schema';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export interface CuentaPorCobrar {
  id: string;
  numeroFactura: string;
  clienteNombre: string;
  fechaEmision: string;
  fechaVencimiento: string | null;
  total: number;
  saldo: number;
  antiguedad: BucketAntiguedad;
}

export function useCuentasPorCobrar() {
  const { token } = useAuth();
  return useQuery<CuentaPorCobrar[]>({
    queryKey: ['cuentas-por-cobrar'],
    queryFn: async () => {
      const res = await fetch('/api/contabilidad/cuentas-por-cobrar', { headers: authHeaders(token ?? '') });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al cargar cuentas por cobrar');
      return json.data;
    },
    enabled: !!token,
  });
}

export function useRegistrarCobroVenta(facturaVentaId: string) {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: RegistrarPagoInput) => {
      const res = await fetch(`/api/contabilidad/facturas-venta/${facturaVentaId}/cobros`, {
        method: 'POST',
        headers: { ...authHeaders(token ?? ''), 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al registrar el cobro');
      return json.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cuentas-por-cobrar'] });
      qc.invalidateQueries({ queryKey: ['cobros-venta', facturaVentaId] });
      qc.invalidateQueries({ queryKey: ['bancos'] });
    },
  });
}
