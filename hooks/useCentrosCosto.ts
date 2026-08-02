/**
 * useCentrosCosto — React Query hooks para el catálogo de centros de costo
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import type { CentroCosto } from '@/types/metalmac.types';
import type { CentroCostoInput, ActualizarCentroCostoInput } from '@/lib/validations/centros-costo.schema';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export function useCentrosCosto(params?: { activo?: boolean }) {
  const { token } = useAuth();
  const sp = new URLSearchParams();
  if (params?.activo !== undefined) sp.set('activo', String(params.activo));

  return useQuery<CentroCosto[]>({
    queryKey: ['centros-costo', params],
    queryFn: async () => {
      const res = await fetch(`/api/centros-costo?${sp.toString()}`, {
        headers: authHeaders(token ?? ''),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al cargar centros de costo');
      return json.data;
    },
    enabled: !!token,
  });
}

export function useCrearCentroCosto() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CentroCostoInput) => {
      const res = await fetch('/api/centros-costo', {
        method: 'POST',
        headers: { ...authHeaders(token ?? ''), 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al crear centro de costo');
      return json.data as CentroCosto;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['centros-costo'] }),
  });
}

export function useActualizarCentroCosto(id: string) {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: ActualizarCentroCostoInput) => {
      const res = await fetch(`/api/centros-costo/${id}`, {
        method: 'PATCH',
        headers: { ...authHeaders(token ?? ''), 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al actualizar centro de costo');
      return json.data as CentroCosto;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['centros-costo'] }),
  });
}
