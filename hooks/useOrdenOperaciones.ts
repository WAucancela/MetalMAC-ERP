/**
 * useOrdenOperaciones — React Query hooks para las operaciones de una Orden de
 * Producción (asignar operario / completar).
 */

'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import type { OrdenOperacion } from '@/types/metalmac.types';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function patchOperacion(
  ordenId: string,
  opId: string,
  token: string,
  body: unknown,
): Promise<OrdenOperacion> {
  const res = await fetch(`/api/ordenes-produccion/${ordenId}/operaciones/${opId}`, {
    method: 'PATCH',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Error al actualizar la operación');
  return json.data;
}

export function useAsignarOperario(ordenId: string) {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ opId, operarioId }: { opId: string; operarioId: string | null }) =>
      patchOperacion(ordenId, opId, token ?? '', { operarioId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ordenes', ordenId] }),
  });
}

export function useCompletarOperacion(ordenId: string) {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ opId, minutosReales }: { opId: string; minutosReales: number }) =>
      patchOperacion(ordenId, opId, token ?? '', { estado: 'COMPLETADA', minutosReales }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ordenes', ordenId] }),
  });
}
