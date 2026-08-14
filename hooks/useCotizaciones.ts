/**
 * hooks/useCotizaciones.ts — React Query hooks para el módulo de cotizaciones.
 */

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import type { Cotizacion, EstadoCotizacion } from '@/types/metalmac.types';
import type { CotizacionInput, ActualizarCotizacionInput, ConvertirCotizacionInput } from '@/lib/validations/cotizaciones.schema';

const BASE = '/api/cotizaciones';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function apiFetch<T>(url: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { ...authHeaders(token), ...(init?.headers ?? {}) },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json.data as T;
}

// ─────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────

export interface CotizacionesFilter {
  estado?: EstadoCotizacion;
  proyectoId?: string;
  desde?: string;
  hasta?: string;
  limit?: number;
}

export function useCotizaciones(filters: CotizacionesFilter = {}) {
  const { token } = useAuth();

  const params = new URLSearchParams();
  if (filters.estado)     params.set('estado', filters.estado);
  if (filters.proyectoId) params.set('proyectoId', filters.proyectoId);
  if (filters.desde)      params.set('desde', filters.desde);
  if (filters.hasta)      params.set('hasta', filters.hasta);
  if (filters.limit)      params.set('limit', String(filters.limit));

  return useQuery({
    queryKey: ['cotizaciones', filters],
    queryFn: () => apiFetch<Cotizacion[]>(`${BASE}?${params.toString()}`, token ?? ''),
    enabled: !!token,
  });
}

export function useCotizacion(id: string | null) {
  const { token } = useAuth();
  return useQuery({
    queryKey: ['cotizaciones', id],
    queryFn: () => apiFetch<Cotizacion>(`${BASE}/${id}`, token ?? ''),
    enabled: !!token && !!id,
  });
}

// ─────────────────────────────────────────────
// Mutaciones
// ─────────────────────────────────────────────

export function useCrearCotizacion() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CotizacionInput) => {
      const res = await fetch(BASE, {
        method: 'POST',
        headers: { ...authHeaders(token ?? ''), 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      return json as { ok: true; id: string };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cotizaciones'] }),
  });
}

export function useActualizarCotizacion(id: string) {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: ActualizarCotizacionInput) => {
      const res = await fetch(`${BASE}/${id}`, {
        method: 'PUT',
        headers: { ...authHeaders(token ?? ''), 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cotizaciones'] });
      qc.invalidateQueries({ queryKey: ['cotizaciones', id] });
    },
  });
}

export function useEliminarCotizacion() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${BASE}/${id}`, { method: 'DELETE', headers: authHeaders(token ?? '') });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cotizaciones'] }),
  });
}

/** Genera el PDF y lo manda por email — pasa BORRADOR -> ENVIADA. */
export function useEnviarCotizacion(id: string) {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`${BASE}/${id}/enviar`, { method: 'POST', headers: authHeaders(token ?? '') });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cotizaciones'] });
      qc.invalidateQueries({ queryKey: ['cotizaciones', id] });
    },
  });
}

/** Cotización APROBADA -> crea el Proyecto y la vincula. */
export function useConvertirCotizacion(id: string) {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: ConvertirCotizacionInput) => {
      const res = await fetch(`${BASE}/${id}/convertir`, {
        method: 'POST',
        headers: { ...authHeaders(token ?? ''), 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      return json as { ok: true; proyectoId: string; proyectoCodigo: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cotizaciones'] });
      qc.invalidateQueries({ queryKey: ['cotizaciones', id] });
      qc.invalidateQueries({ queryKey: ['proyectos'] });
    },
  });
}

/** El cliente respondió — marca APROBADA o RECHAZADA. */
export function useCambiarEstadoCotizacion(id: string) {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (estado: 'APROBADA' | 'RECHAZADA') => {
      const res = await fetch(`${BASE}/${id}/estado`, {
        method: 'PATCH',
        headers: { ...authHeaders(token ?? ''), 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cotizaciones'] });
      qc.invalidateQueries({ queryKey: ['cotizaciones', id] });
    },
  });
}
