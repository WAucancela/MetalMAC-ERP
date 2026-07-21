/**
 * useOrdenes — React Query hooks para Órdenes de Producción
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import type { CrearOrdenInput, ActualizarEstadoOrdenInput } from '@/lib/validations/produccion.schema';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export interface OrdenResumen {
  id: string;
  codigo: string;
  productoId: string;
  cantidad: number;
  estado: 'BORRADOR' | 'EN_PROCESO' | 'COMPLETADA' | 'CANCELADA';
  fechaEntrega: { seconds: number; nanoseconds: number };
  costoEstimado: number;
  costoReal: number | null;
  proyectoId?: string | null;
  notas: string;
}

// ── Lista ─────────────────────────────────────────────────────────────────────

export function useOrdenes(params?: {
  estado?: OrdenResumen['estado'];
  productoId?: string;
  proyectoId?: string;
  desde?: string;
  hasta?: string;
}) {
  const { token } = useAuth();
  const sp = new URLSearchParams();
  if (params?.estado)     sp.set('estado',     params.estado);
  if (params?.productoId) sp.set('productoId', params.productoId);
  if (params?.proyectoId) sp.set('proyectoId', params.proyectoId);
  if (params?.desde)      sp.set('desde',      params.desde);
  if (params?.hasta)      sp.set('hasta',      params.hasta);

  return useQuery<OrdenResumen[]>({
    queryKey: ['ordenes', params],
    queryFn: async () => {
      const res = await fetch(`/api/ordenes-produccion?${sp.toString()}`, {
        headers: authHeaders(token ?? ''),
      });
      if (!res.ok) throw new Error('Error al cargar órdenes');
      const json = await res.json();
      return json.data;
    },
    enabled: !!token,
    staleTime: 30_000, // OPs cambian más seguido que catálogos
  });
}

// ── Detalle ───────────────────────────────────────────────────────────────────

export function useOrden(id: string | null) {
  const { token } = useAuth();
  return useQuery({
    queryKey: ['ordenes', id],
    queryFn: async () => {
      const res = await fetch(`/api/ordenes-produccion/${id}`, {
        headers: authHeaders(token ?? ''),
      });
      if (!res.ok) throw new Error('Error al cargar orden');
      const json = await res.json();
      return json.data;
    },
    enabled: !!token && !!id,
  });
}

// ── Crear ─────────────────────────────────────────────────────────────────────

export function useCrearOrden() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CrearOrdenInput) => {
      const res = await fetch('/api/ordenes-produccion', {
        method: 'POST',
        headers: { ...authHeaders(token ?? ''), 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al crear orden');
      return json as { id: string; codigo: string };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ordenes'] }),
  });
}

// ── Actualizar estado ─────────────────────────────────────────────────────────

export function useActualizarEstadoOrden(id: string) {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: ActualizarEstadoOrdenInput) => {
      const res = await fetch(`/api/ordenes-produccion/${id}`, {
        method: 'PATCH',
        headers: { ...authHeaders(token ?? ''), 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al actualizar estado');
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ordenes'] });
      qc.invalidateQueries({ queryKey: ['ordenes', id] });
      // Invalida stock porque reservar/liberar/consumir lo modifica
      qc.invalidateQueries({ queryKey: ['stock'] });
    },
  });
}
