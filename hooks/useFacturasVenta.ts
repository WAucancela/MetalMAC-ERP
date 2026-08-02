/**
 * hooks/useFacturasVenta.ts — React Query hooks para facturas de venta (Fase 1)
 */

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import type { FacturaVenta } from '@/types/metalmac.types';
import type { FacturaVentaInput, MarcarEmitidaInput } from '@/lib/validations/ventas.schema';

const BASE = '/api/contabilidad/facturas-venta';

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

export interface FacturasVentaFilter {
  proyectoId?: string;
  estado?: 'BORRADOR' | 'EMITIDA' | 'ANULADA';
  desde?: string;
  hasta?: string;
  limit?: number;
}

export function useFacturasVenta(filters: FacturasVentaFilter = {}) {
  const { token } = useAuth();

  const params = new URLSearchParams();
  if (filters.proyectoId) params.set('proyectoId', filters.proyectoId);
  if (filters.estado)     params.set('estado', filters.estado);
  if (filters.desde)      params.set('desde', filters.desde);
  if (filters.hasta)      params.set('hasta', filters.hasta);
  if (filters.limit)      params.set('limit', String(filters.limit));

  return useQuery({
    queryKey: ['facturas-venta', filters],
    queryFn: () => apiFetch<FacturaVenta[]>(`${BASE}?${params.toString()}`, token ?? ''),
    enabled: !!token,
  });
}

export function useFacturaVenta(id: string) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['facturas-venta', id],
    queryFn: () => apiFetch<FacturaVenta>(`${BASE}/${id}`, token ?? ''),
    enabled: !!token && !!id,
  });
}

// ─────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────

export function useCrearFacturaVenta() {
  const { token } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (data: FacturaVentaInput): Promise<{ id: string }> => {
      const res = await fetch(BASE, {
        method: 'POST',
        headers: { ...authHeaders(token ?? ''), 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      return { id: json.id };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['facturas-venta'] }),
  });
}

export function useAnularFacturaVenta() {
  const { token } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${BASE}/${id}`, {
        method: 'PATCH',
        headers: { ...authHeaders(token ?? ''), 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'ANULADA' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
    },
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['facturas-venta'] });
      qc.invalidateQueries({ queryKey: ['facturas-venta', id] });
    },
  });
}

export interface EmitirFacturaVentaResult {
  ok: boolean;
  claveAcceso?: string;
  numeroFactura?: string;
  numeroAutorizacion?: string | null;
  emailEnviado?: boolean;
  ambiente?: 'PRUEBAS' | 'PRODUCCION';
  sriEstado?: string;
  mensaje?: string;
}

/** Fase 2: emisión electrónica real ante el SRI (firma + envío + autorización + RIDE + email). */
export function useEmitirFacturaVenta(id: string) {
  const { token } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<EmitirFacturaVentaResult> => {
      const res = await fetch(`${BASE}/${id}/emitir`, {
        method: 'POST',
        headers: authHeaders(token ?? ''),
      });
      const json = await res.json();
      if (!res.ok && res.status !== 202) {
        const detalles = Array.isArray(json.detalles) ? `: ${json.detalles.join(' | ')}` : '';
        throw new Error((json.error ?? `HTTP ${res.status}`) + detalles);
      }
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['facturas-venta'] });
      qc.invalidateQueries({ queryKey: ['facturas-venta', id] });
    },
  });
}

export function useMarcarEmitidaFacturaVenta(id: string) {
  const { token } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (data: MarcarEmitidaInput) => {
      const res = await fetch(`${BASE}/${id}`, {
        method: 'PATCH',
        headers: { ...authHeaders(token ?? ''), 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['facturas-venta'] });
      qc.invalidateQueries({ queryKey: ['facturas-venta', id] });
    },
  });
}
