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
  /** Si se pasa, trae como mucho una página de este tamaño. Si se omite (caso normal
   *  de esta lista), trae TODAS las facturas que matchean el filtro — paginando el
   *  endpoint por dentro — no solo la primera página de 20. */
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

export function useFacturas(filters: FacturasFilter = {}) {
  const { token } = useAuth();

  const buildParams = (cursor?: string) => {
    const params = new URLSearchParams();
    if (filters.proveedorId) params.set('proveedorId', filters.proveedorId);
    if (filters.estado) params.set('estado', filters.estado);
    if (filters.desde) params.set('desde', filters.desde);
    if (filters.hasta) params.set('hasta', filters.hasta);
    // El endpoint acepta como mucho 100 por página (ver FacturasQuerySchema) —
    // de ahí el tope al armar cada página del loop de abajo.
    params.set('limit', String(Math.min(filters.limit ?? 100, 100)));
    if (cursor) params.set('startAfter', cursor);
    return params;
  };

  return useQuery({
    queryKey: ['facturas', filters],
    queryFn: async () => {
      // Con `limit` explícito, el caller quiere una sola página acotada (ej. un
      // widget de "últimas facturas") — se respeta tal cual, sin paginar de más.
      if (filters.limit) {
        const { data } = await apiFetchPage<FacturaCompra>(`${BASE}?${buildParams()}`, token ?? '');
        return data;
      }

      // Sin `limit`: se asume que quien pide la lista la quiere completa (así la
      // usan hoy FacturaTable y la página de stats) — se recorre el cursor hasta
      // agotarlo. Antes esto se cortaba en la primera página de 20 sin avisar.
      const facturas: FacturaCompra[] = [];
      let cursor: string | undefined;
      do {
        const page = await apiFetchPage<FacturaCompra>(`${BASE}?${buildParams(cursor)}`, token ?? '');
        facturas.push(...page.data);
        cursor = page.nextCursor ?? undefined;
      } while (cursor);
      return facturas;
    },
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

/**
 * Actualiza el estado de una factura. Solo PROCESADA | ANULADA — ver el
 * comentario sobre PatchSchema en la API route: 'PENDIENTE' se sacó a
 * propósito porque no hay transición real hacia atrás.
 */
export function useActualizarEstadoFactura() {
  const { token } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      estado,
    }: {
      id: string;
      estado: 'PROCESADA' | 'ANULADA';
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
      // PROCESADA genera entradas de stock, ANULADA las revierte — igual que
      // useOrdenes.ts invalida ['stock'] tras reservar/liberar/consumir.
      qc.invalidateQueries({ queryKey: ['stock'] });
    },
  });
}

/**
 * Registra una devolución parcial a proveedor sobre una factura ya PROCESADA:
 * resta stock del material indicado sin anular la factura completa.
 */
export function useRegistrarDevolucion(facturaId: string) {
  const { token } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ materialId, cantidad }: { materialId: string; cantidad: number }) => {
      const res = await fetch(`${BASE}/${facturaId}/devolucion`, {
        method: 'POST',
        headers: { ...authHeaders(token ?? ''), 'Content-Type': 'application/json' },
        body: JSON.stringify({ materialId, cantidad }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      return json as { movimientoId: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['facturas', facturaId] });
      qc.invalidateQueries({ queryKey: ['stock'] });
    },
  });
}

/**
 * Mapea manualmente una línea "sin resolver" a un material — fija material_id en
 * la línea y guarda la equivalencia para que la próxima factura de este proveedor
 * con el mismo código se resuelva sola.
 */
export function useMapearLineaFactura(facturaId: string) {
  const { token } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      lineaId,
      materialId,
      unidadProveedorId,
      factorConversion,
    }: {
      lineaId: string;
      materialId: string;
      unidadProveedorId: string;
      factorConversion: number;
    }) => {
      const res = await fetch(`${BASE}/${facturaId}/lineas/${lineaId}/mapear`, {
        method: 'PATCH',
        headers: { ...authHeaders(token ?? ''), 'Content-Type': 'application/json' },
        body: JSON.stringify({ materialId, unidadProveedorId, factorConversion }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['facturas', facturaId] }),
  });
}
