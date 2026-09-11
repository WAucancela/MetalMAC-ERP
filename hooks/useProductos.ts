/**
 * useProductos — React Query hooks para productos y BOM
 */

'use client';

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import type { ProductoInput } from '@/lib/validations/produccion.schema';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

// ── Tipos ligeros para el cliente ────────────────────────────────────────────

export interface ProductoResumen {
  id: string;
  codigo: string;
  nombre: string;
  tipo: 'PRODUCTO_TERMINADO' | 'SEMIELABORADO';
  unidadVenta: string;
  precioVenta: number;
  activo: boolean;
}

// ── Productos ─────────────────────────────────────────────────────────────────

export function useProductos(params?: {
  tipo?: 'PRODUCTO_TERMINADO' | 'SEMIELABORADO';
  activo?: boolean;
  q?: string;
  /**
   * El backend pagina (default 50 por página). Los usos tipo "catálogo
   * completo" (selects/combobox de cotizaciones, producción, etc.) deben
   * pasar un límite alto explícito para no perder productos silenciosamente;
   * la vista paginada de verdad es `useProductosPaginados`.
   */
  limit?: number;
}) {
  const { token } = useAuth();
  const sp = new URLSearchParams();
  if (params?.tipo   !== undefined) sp.set('tipo',   params.tipo);
  if (params?.activo !== undefined) sp.set('activo', String(params.activo));
  if (params?.q)                    sp.set('q',      params.q);
  if (params?.limit  !== undefined) sp.set('limit',  String(params.limit));

  return useQuery<ProductoResumen[]>({
    queryKey: ['productos', params],
    queryFn: async () => {
      const res = await fetch(`/api/productos?${sp.toString()}`, {
        headers: authHeaders(token ?? ''),
      });
      if (!res.ok) throw new Error('Error al cargar productos');
      const json = await res.json();
      return json.data;
    },
    enabled: !!token,
    staleTime: 5 * 60_000,
  });
}

// ── Productos paginados (para /productos, que sí navega página a página) ────

export interface ProductosPaginados {
  items: ProductoResumen[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function useProductosPaginados(params: {
  tipo?: 'PRODUCTO_TERMINADO' | 'SEMIELABORADO';
  activo?: boolean;
  q?: string;
  page: number;
  limit: number;
}) {
  const { token } = useAuth();
  const sp = new URLSearchParams();
  if (params.tipo   !== undefined) sp.set('tipo',   params.tipo);
  if (params.activo !== undefined) sp.set('activo', String(params.activo));
  if (params.q)                    sp.set('q',      params.q);
  sp.set('page',  String(params.page));
  sp.set('limit', String(params.limit));

  return useQuery<ProductosPaginados>({
    queryKey: ['productos', 'paginado', params],
    queryFn: async () => {
      const res = await fetch(`/api/productos?${sp.toString()}`, {
        headers: authHeaders(token ?? ''),
      });
      if (!res.ok) throw new Error('Error al cargar productos');
      const json = await res.json();
      const total = json.total ?? json.data.length;
      return {
        items: json.data as ProductoResumen[],
        total,
        page: params.page,
        limit: params.limit,
        totalPages: Math.max(1, Math.ceil(total / params.limit)),
      };
    },
    enabled: !!token,
    staleTime: 60_000,
    placeholderData: keepPreviousData, // evita el parpadeo al cambiar de página
  });
}

export function useProducto(id: string | null) {
  const { token } = useAuth();
  return useQuery({
    queryKey: ['productos', id],
    queryFn: async () => {
      const res = await fetch(`/api/productos/${id}`, {
        headers: authHeaders(token ?? ''),
      });
      if (!res.ok) throw new Error('Error al cargar producto');
      const json = await res.json();
      return json.data;
    },
    enabled: !!token && !!id,
    staleTime: 5 * 60_000,
  });
}

export function useCrearProducto() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: ProductoInput) => {
      const res = await fetch('/api/productos', {
        method: 'POST',
        headers: { ...authHeaders(token ?? ''), 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al crear producto');
      return json;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['productos'] }),
  });
}

export function useActualizarProducto(id: string) {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<ProductoInput>) => {
      const res = await fetch(`/api/productos/${id}`, {
        method: 'PUT',
        headers: { ...authHeaders(token ?? ''), 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al actualizar producto');
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['productos'] });
      qc.invalidateQueries({ queryKey: ['productos', id] });
    },
  });
}
