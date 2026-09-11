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
  /** Si se pasa, trae como mucho una página de este tamaño. Si se omite (caso
   *  normal de esta lista), trae TODAS las facturas que matchean el filtro —
   *  paginando el endpoint por dentro, no solo su primera página de 20. */
  limit?: number;
}

async function apiFetchPage<T>(
  url: string,
  token: string,
): Promise<{ data: T[]; nextCursor: string | null }> {
  const res = await fetch(url, { headers: authHeaders(token) });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return { data: json.data as T[], nextCursor: json.nextCursor ?? null };
}

export function useFacturasVenta(filters: FacturasVentaFilter = {}) {
  const { token } = useAuth();

  const buildParams = (cursor?: string) => {
    const params = new URLSearchParams();
    if (filters.proyectoId) params.set('proyectoId', filters.proyectoId);
    if (filters.estado)     params.set('estado', filters.estado);
    if (filters.desde)      params.set('desde', filters.desde);
    if (filters.hasta)      params.set('hasta', filters.hasta);
    // El endpoint acepta como mucho 100 por página (ver FacturasVentaQuerySchema).
    params.set('limit', String(Math.min(filters.limit ?? 100, 100)));
    if (cursor) params.set('startAfter', cursor);
    return params;
  };

  return useQuery({
    queryKey: ['facturas-venta', filters],
    queryFn: async () => {
      // Con `limit` explícito, el caller quiere una sola página acotada —
      // se respeta tal cual, sin paginar de más.
      if (filters.limit) {
        const { data } = await apiFetchPage<FacturaVenta>(`${BASE}?${buildParams()}`, token ?? '');
        return data;
      }

      // Sin `limit`: se asume que quien pide la lista la quiere completa (así
      // la usan hoy las stats de la página) — se recorre el cursor hasta
      // agotarlo. Antes esto se cortaba en la primera página de 20 sin avisar.
      const facturas: FacturaVenta[] = [];
      let cursor: string | undefined;
      do {
        const page = await apiFetchPage<FacturaVenta>(`${BASE}?${buildParams(cursor)}`, token ?? '');
        facturas.push(...page.data);
        cursor = page.nextCursor ?? undefined;
      } while (cursor);
      return facturas;
    },
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
