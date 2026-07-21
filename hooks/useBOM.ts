/**
 * useBOM — React Query hooks para Bill of Materials
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import type { BOMInput } from '@/lib/validations/produccion.schema';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export function useBOM(productoId: string | null, opciones?: { costo?: number }) {
  const { token } = useAuth();
  const sp = new URLSearchParams();
  if (opciones?.costo !== undefined) sp.set('costo', String(opciones.costo));

  return useQuery({
    queryKey: ['bom', productoId, opciones],
    queryFn: async () => {
      const res = await fetch(`/api/bom/${productoId}?${sp.toString()}`, {
        headers: authHeaders(token ?? ''),
      });
      if (!res.ok) throw new Error('Error al cargar BOM');
      const json = await res.json();
      return json.data;
    },
    enabled: !!token && !!productoId,
    staleTime: 2 * 60_000,
  });
}

export function useGuardarBOM(productoId: string) {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: BOMInput) => {
      const res = await fetch(`/api/bom/${productoId}`, {
        method: 'PUT',
        headers: { ...authHeaders(token ?? ''), 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al guardar BOM');
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bom', productoId] });
      qc.invalidateQueries({ queryKey: ['productos', productoId] });
    },
  });
}
