/**
 * usePedidosTienda — React Query hooks para la bandeja de pedidos de la Tienda de
 * Muebles de tallermac-web.
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import type { ActualizarEstadoPedidoTiendaInput } from '@/lib/validations/pedidos-tienda.schema';
import type { PedidoTienda } from '@/types/metalmac.types';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export function usePedidosTienda(params?: {
  estado?: PedidoTienda['estado'];
  enabled?: boolean;
}) {
  const { token } = useAuth();
  const sp = new URLSearchParams();
  if (params?.estado) sp.set('estado', params.estado);

  return useQuery<PedidoTienda[]>({
    queryKey: ['pedidos-tienda', params],
    queryFn: async () => {
      const res = await fetch(`/api/pedidos-tienda?${sp.toString()}`, {
        headers: authHeaders(token ?? ''),
      });
      if (!res.ok) throw new Error('Error al cargar pedidos');
      const json = await res.json();
      return json.data;
    },
    enabled: !!token && (params?.enabled ?? true),
    staleTime: 30_000,
  });
}

export function usePedidoTienda(id: string | null) {
  const { token } = useAuth();
  return useQuery<PedidoTienda>({
    queryKey: ['pedidos-tienda', id],
    queryFn: async () => {
      const res = await fetch(`/api/pedidos-tienda/${id}`, {
        headers: authHeaders(token ?? ''),
      });
      if (!res.ok) throw new Error('Error al cargar pedido');
      const json = await res.json();
      return json.data;
    },
    enabled: !!token && !!id,
  });
}

export function useActualizarEstadoPedidoTienda(id: string) {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: ActualizarEstadoPedidoTiendaInput) => {
      const res = await fetch(`/api/pedidos-tienda/${id}`, {
        method: 'PATCH',
        headers: { ...authHeaders(token ?? ''), 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al actualizar pedido');
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pedidos-tienda'] });
      qc.invalidateQueries({ queryKey: ['pedidos-tienda', id] });
    },
  });
}
