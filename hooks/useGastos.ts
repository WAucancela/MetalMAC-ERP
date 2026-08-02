'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import type { GastoInput, ActualizarGastoInput } from '@/lib/validations/proyectos.schema';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export function useGastos(params?: {
  proyectoId?: string;
  centroCostoId?: string;
  categoria?: string;
  desde?: string;
  hasta?: string;
}) {
  const { token } = useAuth();
  const sp = new URLSearchParams();
  if (params?.proyectoId)    sp.set('proyectoId',    params.proyectoId);
  if (params?.centroCostoId) sp.set('centroCostoId', params.centroCostoId);
  if (params?.categoria)     sp.set('categoria',      params.categoria);
  if (params?.desde)         sp.set('desde',          params.desde);
  if (params?.hasta)         sp.set('hasta',          params.hasta);

  return useQuery({
    queryKey: ['gastos', params],
    queryFn: async () => {
      const res = await fetch(`/api/gastos?${sp.toString()}`, {
        headers: authHeaders(token ?? ''),
      });
      if (!res.ok) throw new Error('Error al cargar gastos');
      return (await res.json()).data;
    },
    // Antes exigía proyectoId (uso embebido en detalle de proyecto); ahora
    // también se usa para la lista general de gastos sin proyecto.
    enabled: !!token,
    staleTime: 30_000,
  });
}

export function useCrearGasto() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: GastoInput) => {
      const res = await fetch('/api/gastos', {
        method: 'POST',
        headers: { ...authHeaders(token ?? ''), 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al registrar gasto');
      return json;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['gastos'] });
      if (variables.proyectoId) qc.invalidateQueries({ queryKey: ['proyectos', variables.proyectoId] });
    },
  });
}

export function useActualizarGasto(id: string, proyectoId?: string | null) {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: ActualizarGastoInput) => {
      const res = await fetch(`/api/gastos/${id}`, {
        method: 'PUT',
        headers: { ...authHeaders(token ?? ''), 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al actualizar gasto');
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gastos'] });
      if (proyectoId) qc.invalidateQueries({ queryKey: ['proyectos', proyectoId] });
    },
  });
}

export function useEliminarGasto(proyectoId?: string | null) {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/gastos/${id}`, {
        method: 'DELETE',
        headers: authHeaders(token ?? ''),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al eliminar gasto');
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gastos'] });
      if (proyectoId) qc.invalidateQueries({ queryKey: ['proyectos', proyectoId] });
    },
  });
}
