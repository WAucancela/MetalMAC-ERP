/**
 * useOperarios — React Query hooks para el catálogo de operarios
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import type { Operario } from '@/types/metalmac.types';
import type { OperarioInput, ActualizarOperarioInput } from '@/lib/validations/produccion.schema';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

// ── Lista ─────────────────────────────────────────────────────────────────────

export function useOperarios(params?: { activo?: boolean }) {
  const { token } = useAuth();
  const sp = new URLSearchParams();
  if (params?.activo !== undefined) sp.set('activo', String(params.activo));

  return useQuery<Operario[]>({
    queryKey: ['operarios', params],
    queryFn: async () => {
      const res = await fetch(`/api/operarios?${sp.toString()}`, {
        headers: authHeaders(token ?? ''),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al cargar operarios');
      return json.data;
    },
    enabled: !!token,
  });
}

// ── Crear ─────────────────────────────────────────────────────────────────────

export function useCrearOperario() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: OperarioInput) => {
      const res = await fetch('/api/operarios', {
        method: 'POST',
        headers: { ...authHeaders(token ?? ''), 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al crear operario');
      return json.data as Operario;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['operarios'] }),
  });
}

// ── Actualizar ────────────────────────────────────────────────────────────────

export function useActualizarOperario(id: string) {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: ActualizarOperarioInput) => {
      const res = await fetch(`/api/operarios/${id}`, {
        method: 'PATCH',
        headers: { ...authHeaders(token ?? ''), 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al actualizar operario');
      return json.data as Operario;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['operarios'] }),
  });
}
