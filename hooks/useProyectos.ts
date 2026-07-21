'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import type { ProyectoInput, ActualizarProyectoInput } from '@/lib/validations/proyectos.schema';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

// ── Proyectos ─────────────────────────────────────────────────────────────────

export function useProyectos(params?: {
  estado?: 'PLANIFICACION' | 'ACTIVO' | 'PAUSADO' | 'COMPLETADO' | 'CANCELADO';
  cliente?: string;
}) {
  const { token } = useAuth();
  const sp = new URLSearchParams();
  if (params?.estado)  sp.set('estado',  params.estado);
  if (params?.cliente) sp.set('cliente', params.cliente);

  return useQuery({
    queryKey: ['proyectos', params],
    queryFn: async () => {
      const res = await fetch(`/api/proyectos?${sp.toString()}`, {
        headers: authHeaders(token ?? ''),
      });
      if (!res.ok) throw new Error('Error al cargar proyectos');
      return (await res.json()).data;
    },
    enabled: !!token,
    staleTime: 60_000,
  });
}

export function useProyecto(id: string | null) {
  const { token } = useAuth();
  return useQuery({
    queryKey: ['proyectos', id],
    queryFn: async () => {
      const res = await fetch(`/api/proyectos/${id}`, {
        headers: authHeaders(token ?? ''),
      });
      if (!res.ok) throw new Error('Error al cargar proyecto');
      return (await res.json()).data;
    },
    enabled: !!token && !!id,
  });
}

export function useCrearProyecto() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: ProyectoInput) => {
      const res = await fetch('/api/proyectos', {
        method: 'POST',
        headers: { ...authHeaders(token ?? ''), 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al crear proyecto');
      return json as { id: string; codigo: string };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['proyectos'] }),
  });
}

export function useActualizarProyecto(id: string) {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: ActualizarProyectoInput) => {
      const res = await fetch(`/api/proyectos/${id}`, {
        method: 'PUT',
        headers: { ...authHeaders(token ?? ''), 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al actualizar proyecto');
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proyectos'] });
      qc.invalidateQueries({ queryKey: ['proyectos', id] });
    },
  });
}

export function useEliminarProyecto() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/proyectos/${id}`, {
        method: 'DELETE',
        headers: authHeaders(token ?? ''),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al cancelar proyecto');
      return json;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['proyectos'] }),
  });
}
