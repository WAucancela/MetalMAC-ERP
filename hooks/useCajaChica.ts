/**
 * useCajaChica — React Query hooks para los movimientos de caja chica.
 */

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import type { CajaMovimiento } from '@/types/metalmac.types';
import type { CajaMovimientoInput, ActualizarCajaMovimientoInput } from '@/lib/validations/caja.schema';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export function useCajaChica(params?: { desde?: string; hasta?: string }) {
  const { token } = useAuth();
  const sp = new URLSearchParams();
  if (params?.desde) sp.set('desde', params.desde);
  if (params?.hasta) sp.set('hasta', params.hasta);

  return useQuery<CajaMovimiento[]>({
    queryKey: ['caja-chica', params],
    queryFn: async () => {
      const res = await fetch(`/api/caja-chica?${sp.toString()}`, { headers: authHeaders(token ?? '') });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al cargar movimientos de caja');
      return json.data;
    },
    enabled: !!token,
  });
}

export function useCrearMovimientoCaja() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CajaMovimientoInput) => {
      const res = await fetch('/api/caja-chica', {
        method: 'POST',
        headers: { ...authHeaders(token ?? ''), 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al registrar el movimiento');
      return json.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['caja-chica'] }),
  });
}

export function useActualizarMovimientoCaja(id: string) {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: ActualizarCajaMovimientoInput) => {
      const res = await fetch(`/api/caja-chica/${id}`, {
        method: 'PUT',
        headers: { ...authHeaders(token ?? ''), 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al actualizar el movimiento');
      return json.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['caja-chica'] }),
  });
}

export function useEliminarMovimientoCaja() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/caja-chica/${id}`, {
        method: 'DELETE',
        headers: authHeaders(token ?? ''),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al eliminar el movimiento');
      return json;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['caja-chica'] }),
  });
}
