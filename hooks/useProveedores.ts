/**
 * hooks/useProveedores.ts — React Query hooks para proveedores
 */

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import type { Proveedor } from '@/types/metalmac.types';

const BASE = '/api/proveedores';

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

export function useProveedores(opts: { activo?: boolean; q?: string } = {}) {
  const { token } = useAuth();

  const params = new URLSearchParams();
  if (opts.activo !== undefined) params.set('activo', String(opts.activo));
  if (opts.q) params.set('q', opts.q);

  return useQuery({
    queryKey: ['proveedores', opts],
    queryFn: () => apiFetch<Proveedor[]>(`${BASE}?${params.toString()}`, token ?? ''),
    enabled: !!token,
    staleTime: 5 * 60_000, // 5 min — los proveedores cambian poco
  });
}

export function useProveedor(id: string) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['proveedores', id],
    queryFn: () =>
      apiFetch<{ proveedor: Proveedor; facturas: unknown[] }>(`${BASE}/${id}`, token ?? ''),
    enabled: !!token && !!id,
  });
}

// ─────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────

export function useCrearProveedor() {
  const { token } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<Proveedor, 'id'>): Promise<{ id: string }> => {
      const res = await fetch(BASE, {
        method: 'POST',
        headers: { ...authHeaders(token ?? ''), 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      return { id: json.id };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['proveedores'] }),
  });
}

export function useActualizarProveedor() {
  const { token } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Omit<Proveedor, 'id'>> }) => {
      const res = await fetch(`${BASE}/${id}`, {
        method: 'PUT',
        headers: { ...authHeaders(token ?? ''), 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['proveedores'] });
      qc.invalidateQueries({ queryKey: ['proveedores', id] });
    },
  });
}

export function useEliminarProveedor() {
  const { token } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${BASE}/${id}`, {
        method: 'DELETE',
        headers: authHeaders(token ?? ''),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['proveedores'] }),
  });
}
