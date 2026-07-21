/**
 * hooks/useFacturas.ts — React Query hooks para facturas de compra y upload de XML
 */

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import type { FacturaCompra, FacturaXMLParseada, LineaResuelta } from '@/types/metalmac.types';

const BASE = '/api/contabilidad/facturas';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

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

export interface FacturasFilter {
  proveedorId?: string;
  estado?: 'PENDIENTE' | 'PROCESADA' | 'ANULADA';
  desde?: string;
  hasta?: string;
  limit?: number;
}

export function useFacturas(filters: FacturasFilter = {}) {
  const { token } = useAuth();

  const params = new URLSearchParams();
  if (filters.proveedorId) params.set('proveedorId', filters.proveedorId);
  if (filters.estado) params.set('estado', filters.estado);
  if (filters.desde) params.set('desde', filters.desde);
  if (filters.hasta) params.set('hasta', filters.hasta);
  if (filters.limit) params.set('limit', String(filters.limit));

  return useQuery({
    queryKey: ['facturas', filters],
    queryFn: () =>
      apiFetch<FacturaCompra[]>(`${BASE}?${params.toString()}`, token ?? ''),
    enabled: !!token,
  });
}

export function useFactura(id: string) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['facturas', id],
    queryFn: () => apiFetch<FacturaCompra>(`${BASE}/${id}`, token ?? ''),
    enabled: !!token && !!id,
  });
}

// ─────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────

/** Parsea un XML de factura SRI sin guardar nada */
export function useParsearXML() {
  const { token } = useAuth();

  return useMutation({
    mutationFn: async (file: File): Promise<FacturaXMLParseada> => {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/sri/parse-xml', {
        method: 'POST',
        headers: authHeaders(token ?? ''),
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      return json.data as FacturaXMLParseada;
    },
  });
}

/** Resuelve las líneas de una factura contra tabla_equivalencias */
export function useResolverEquivalencias() {
  const { token } = useAuth();

  return useMutation({
    mutationFn: async ({
      proveedorId,
      lineas,
    }: {
      proveedorId: string;
      lineas: FacturaXMLParseada['lineas'];
    }): Promise<{ lineas: LineaResuelta[]; porcentajeResolucion: number }> => {
      const res = await fetch('/api/sri/resolver-equivalencias', {
        method: 'POST',
        headers: { ...authHeaders(token ?? ''), 'Content-Type': 'application/json' },
        body: JSON.stringify({ proveedorId, lineas }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      return json.data;
    },
  });
}

/** Crea una factura de compra (después de parsear + resolver) */
export function useCrearFactura() {
  const { token } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (data: unknown): Promise<{ id: string }> => {
      const res = await fetch(BASE, {
        method: 'POST',
        headers: { ...authHeaders(token ?? ''), 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      return { id: json.id };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['facturas'] }),
  });
}

/** Actualiza el estado de una factura */
export function useActualizarEstadoFactura() {
  const { token } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      estado,
    }: {
      id: string;
      estado: 'PENDIENTE' | 'PROCESADA' | 'ANULADA';
    }) => {
      const res = await fetch(`${BASE}/${id}`, {
        method: 'PATCH',
        headers: { ...authHeaders(token ?? ''), 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['facturas'] });
      qc.invalidateQueries({ queryKey: ['facturas', vars.id] });
    },
  });
}
