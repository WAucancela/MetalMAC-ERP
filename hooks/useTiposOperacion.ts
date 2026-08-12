/**
 * useTiposOperacion — React Query hooks para el catálogo de tipos de operación
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import type { TipoOperacion } from '@/types/metalmac.types';
import type { TipoOperacionInput, ActualizarTipoOperacionInput } from '@/lib/validations/produccion.schema';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

// ── Lista ─────────────────────────────────────────────────────────────────────

export function useTiposOperacion(params?: { activo?: boolean }) {
  const { token } = useAuth();
  const sp = new URLSearchParams();
  if (params?.activo !== undefined) sp.set('activo', String(params.activo));

  return useQuery<TipoOperacion[]>({
    queryKey: ['tipos-operacion', params],
    queryFn: async () => {
      const res = await fetch(`/api/tipos-operacion?${sp.toString()}`, {
        headers: authHeaders(token ?? ''),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al cargar tipos de operación');
      return json.data;
    },
    enabled: !!token,
  });
}

// ── Crear ─────────────────────────────────────────────────────────────────────

export function useCrearTipoOperacion() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: TipoOperacionInput) => {
      const res = await fetch('/api/tipos-operacion', {
        method: 'POST',
        headers: { ...authHeaders(token ?? ''), 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al crear el tipo de operación');
      return json.data as TipoOperacion;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tipos-operacion'] }),
  });
}

// ── Actualizar ────────────────────────────────────────────────────────────────

export function useActualizarTipoOperacion(id: string) {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: ActualizarTipoOperacionInput) => {
      const res = await fetch(`/api/tipos-operacion/${id}`, {
        method: 'PATCH',
        headers: { ...authHeaders(token ?? ''), 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al actualizar el tipo de operación');
      return json.data as TipoOperacion;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tipos-operacion'] }),
  });
}
