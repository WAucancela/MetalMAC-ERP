/**
 * useInventario — hooks React Query para materiales.
 *
 * Patrón: el token de Firebase Auth se pasa como header Bearer
 * en cada request a las API Routes server-side.
 */
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import type {
  Material, MovimientoInventario,
} from '@/types/metalmac.types';
import type {
  CreateMaterialInput,
  UpdateMaterialInput,
  CreateMovimientoInput,
} from '@/lib/validations/inventario.schema';

// ── Fetch con auth ────────────────────────────────────────────────────────────

async function apiFetch<T>(
  url: string,
  token: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message ?? 'Error en la petición');
  return json.data as T;
}

// ── Tipos de respuesta ────────────────────────────────────────────────────────

export type MaterialConStock = Material & {
  stock: {
    cantidadDisponible: number;
    cantidadReservada: number;
    cantidadMinima: number;
    ubicacion: string;
  } | null;
};

export type MaterialDetalle = {
  material: Material;
  stock: {
    cantidadDisponible: number;
    cantidadReservada: number;
    cantidadMinima: number;
    cantidadMaxima: number | null;
    ubicacion: string;
  } | null;
  movimientos: MovimientoInventario[];
};

// ── Query keys ────────────────────────────────────────────────────────────────

export const INVENTARIO_KEYS = {
  all:        ['inventario'] as const,
  materiales: (filters?: object) => [...INVENTARIO_KEYS.all, 'materiales', filters] as const,
  material:   (id: string) => [...INVENTARIO_KEYS.all, 'material', id] as const,
  movimientos:(filters?: object) => [...INVENTARIO_KEYS.all, 'movimientos', filters] as const,
};

// ── Hooks de consulta ─────────────────────────────────────────────────────────

export function useMateriales(filters?: {
  tipo?: string;
  activo?: boolean;
  q?: string;
}) {
  const { token } = useAuth();

  return useQuery({
    queryKey:  INVENTARIO_KEYS.materiales(filters),
    enabled:   !!token,
    queryFn:   async () => {
      const params = new URLSearchParams();
      if (filters?.tipo)             params.set('tipo', filters.tipo);
      if (filters?.activo !== undefined) params.set('activo', String(filters.activo));
      if (filters?.q)                params.set('q', filters.q);

      return apiFetch<MaterialConStock[]>(
        `/api/inventario/materiales?${params}`,
        token!,
      );
    },
    staleTime: 30_000,
  });
}

export function useMaterial(id: string) {
  const { token } = useAuth();

  return useQuery({
    queryKey: INVENTARIO_KEYS.material(id),
    enabled:  !!token && !!id,
    queryFn:  () =>
      apiFetch<MaterialDetalle>(
        `/api/inventario/materiales/${id}`,
        token!,
      ),
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useCrearMaterial() {
  const { token } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateMaterialInput) =>
      apiFetch<Material>('/api/inventario/materiales', token!, {
        method: 'POST',
        body:   JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: INVENTARIO_KEYS.all });
    },
  });
}

export function useActualizarMaterial(id: string) {
  const { token } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateMaterialInput) =>
      apiFetch<Material>(`/api/inventario/materiales/${id}`, token!, {
        method: 'PUT',
        body:   JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: INVENTARIO_KEYS.material(id) });
      qc.invalidateQueries({ queryKey: INVENTARIO_KEYS.materiales() });
    },
  });
}

// ── Unidades de medida ────────────────────────────────────────────────────────

export function useUnidades() {
  const { token } = useAuth();
  return useQuery({
    queryKey: ['unidades_medida'],
    queryFn: () => apiFetch<any[]>('/api/unidades-medida', token!),
    staleTime: 30 * 60_000, // catálogo estático, 30 min
    enabled: !!token,
  });
}

// ─────────────────────────────────────────────────────────────────────────────

export function useRegistrarMovimiento() {
  const { token } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateMovimientoInput) =>
      apiFetch<{ id: string }>('/api/inventario/movimientos', token!, {
        method: 'POST',
        body:   JSON.stringify(input),
      }),
    onSuccess: (_data, variables) => {
      // Invalida el material afectado y el listado general
      qc.invalidateQueries({ queryKey: INVENTARIO_KEYS.material(variables.materialId) });
      qc.invalidateQueries({ queryKey: INVENTARIO_KEYS.materiales() });
    },
  });
}
