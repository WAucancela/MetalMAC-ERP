/**
 * hooks/useClientes.ts — React Query hooks para el módulo de Clientes.
 */
'use client';

import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import type { Cliente, InteraccionCliente } from '@/types/metalmac.types';
import type { ClienteInput, InteraccionInput } from '@/lib/validations/clientes.schema';

const BASE = '/api/clientes';

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

/**
 * Catálogo completo (sin paginar) — para selects/combobox en cotizaciones,
 * proyectos, etc. Pasar `limit` alto explícito, igual que useProductos /
 * useMateriales, para no perder clientes silenciosamente por el límite
 * default del backend.
 */
export function useClientes(opts: { activo?: boolean; q?: string; limit?: number } = {}) {
  const { token } = useAuth();

  const params = new URLSearchParams();
  if (opts.activo !== undefined) params.set('activo', String(opts.activo));
  if (opts.q)                    params.set('q', opts.q);
  if (opts.limit !== undefined)  params.set('limit', String(opts.limit));

  return useQuery({
    queryKey: ['clientes', opts],
    queryFn: () => apiFetch<Cliente[]>(`${BASE}?${params.toString()}`, token ?? ''),
    enabled: !!token,
    staleTime: 5 * 60_000,
  });
}

export interface ClientesPaginados {
  items: Cliente[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Vista paginada de verdad — para la tabla de /clientes. */
export function useClientesPaginados(params: {
  activo?: boolean;
  q?: string;
  page: number;
  limit: number;
}) {
  const { token } = useAuth();
  const sp = new URLSearchParams();
  if (params.activo !== undefined) sp.set('activo', String(params.activo));
  if (params.q)                    sp.set('q', params.q);
  sp.set('page',  String(params.page));
  sp.set('limit', String(params.limit));

  return useQuery<ClientesPaginados>({
    queryKey: ['clientes', 'paginado', params],
    queryFn: async () => {
      const res = await fetch(`${BASE}?${sp.toString()}`, { headers: authHeaders(token ?? '') });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      const total = json.total ?? json.data.length;
      return {
        items: json.data as Cliente[],
        total,
        page: params.page,
        limit: params.limit,
        totalPages: Math.max(1, Math.ceil(total / params.limit)),
      };
    },
    enabled: !!token,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

export interface ClienteDetalle {
  cliente: Cliente;
  cotizaciones: Array<{ id: string; numero: string; estado: string; fechaEmision: string; fechaVencimiento: string; total: number }>;
  proyectos: Array<{ id: string; codigo: string; nombre: string; estado: string; fechaInicio: string; presupuesto: number; costoReal: number }>;
  facturas: Array<{ id: string; numeroFactura: string; estado: string; fechaEmision: string; total: number }>;
  pedidosWeb: Array<{ id: string; numeroPedido: string; wcStatus: string; estadoRevision: string; total: number; moneda: string; recibidoEn: string }>;
  interacciones: InteraccionCliente[];
}

export function useCliente(id: string) {
  const { token } = useAuth();
  return useQuery({
    queryKey: ['clientes', id],
    queryFn: () => apiFetch<ClienteDetalle>(`${BASE}/${id}`, token ?? ''),
    enabled: !!token && !!id,
  });
}

interface ConsultaIdentificacion {
  found: boolean;
  razonSocial?: string;
  tipoContribuyente?: 'PERSONA_NATURAL' | 'SOCIEDAD';
  estado?: string;
}

/** Autocompletado opcional de razón social a partir del RUC (ver comentario
 * en la API route sobre las limitaciones de este servicio no oficial). */
export function useConsultarIdentificacion() {
  const { token } = useAuth();
  return useMutation({
    mutationFn: (ruc: string) =>
      apiFetch<ConsultaIdentificacion>(`${BASE}/consultar-identificacion?ruc=${ruc}`, token ?? ''),
  });
}

// ─────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────

export function useCrearCliente() {
  const { token } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (data: ClienteInput): Promise<{ id: string }> => {
      const res = await fetch(BASE, {
        method: 'POST',
        headers: { ...authHeaders(token ?? ''), 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      return { id: json.id };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clientes'] }),
  });
}

export function useActualizarCliente() {
  const { token } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ClienteInput> }) => {
      const res = await fetch(`${BASE}/${id}`, {
        method: 'PUT',
        headers: { ...authHeaders(token ?? ''), 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['clientes'] });
      qc.invalidateQueries({ queryKey: ['clientes', id] });
    },
  });
}

export function useEliminarCliente() {
  const { token } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${BASE}/${id}`, { method: 'DELETE', headers: authHeaders(token ?? '') });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clientes'] }),
  });
}

export function useCrearInteraccion(clienteId: string) {
  const { token } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: InteraccionInput) =>
      apiFetch<InteraccionCliente>(`${BASE}/${clienteId}/interacciones`, token ?? '', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clientes', clienteId] }),
  });
}
