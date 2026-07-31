/**
 * usePedidosWooCommerce — React Query hooks para la bandeja de revisión de pedidos
 * de tallermac.com (WooCommerce).
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import type {
  ActualizarEstadoRevisionInput, ConvertirLineaPedidoInput,
} from '@/lib/validations/pedidos-woocommerce.schema';
import type { PedidoWooCommerce } from '@/types/metalmac.types';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

// ── Lista ─────────────────────────────────────────────────────────────────────

export function usePedidosWooCommerce(params?: {
  estadoRevision?: PedidoWooCommerce['estadoRevision'];
  enabled?: boolean;
}) {
  const { token } = useAuth();
  const sp = new URLSearchParams();
  if (params?.estadoRevision) sp.set('estadoRevision', params.estadoRevision);

  return useQuery<PedidoWooCommerce[]>({
    queryKey: ['pedidos-woocommerce', params],
    queryFn: async () => {
      const res = await fetch(`/api/pedidos-woocommerce?${sp.toString()}`, {
        headers: authHeaders(token ?? ''),
      });
      if (!res.ok) throw new Error('Error al cargar pedidos');
      const json = await res.json();
      return json.data;
    },
    // GET /api/pedidos-woocommerce sólo lo permiten GERENTE/PRODUCCION — el llamador
    // (Sidebar) pasa `enabled: false` para otros roles para no disparar un 403 en cada carga.
    enabled: !!token && (params?.enabled ?? true),
    staleTime: 30_000,
  });
}

// ── Detalle ───────────────────────────────────────────────────────────────────

export function usePedidoWooCommerce(id: string | null) {
  const { token } = useAuth();
  return useQuery<PedidoWooCommerce>({
    queryKey: ['pedidos-woocommerce', id],
    queryFn: async () => {
      const res = await fetch(`/api/pedidos-woocommerce/${id}`, {
        headers: authHeaders(token ?? ''),
      });
      if (!res.ok) throw new Error('Error al cargar pedido');
      const json = await res.json();
      return json.data;
    },
    enabled: !!token && !!id,
  });
}

// ── Actualizar estado de revisión ─────────────────────────────────────────────

export function useActualizarEstadoPedido(id: string) {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: ActualizarEstadoRevisionInput) => {
      const res = await fetch(`/api/pedidos-woocommerce/${id}`, {
        method: 'PATCH',
        headers: { ...authHeaders(token ?? ''), 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al actualizar pedido');
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pedidos-woocommerce'] });
      qc.invalidateQueries({ queryKey: ['pedidos-woocommerce', id] });
    },
  });
}

// ── Convertir línea en Orden de Producción ────────────────────────────────────

export function useConvertirLineaPedido(pedidoId: string, lineaId: string) {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: ConvertirLineaPedidoInput) => {
      const res = await fetch(`/api/pedidos-woocommerce/${pedidoId}/lineas/${lineaId}/convertir`, {
        method: 'POST',
        headers: { ...authHeaders(token ?? ''), 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al convertir línea');
      return json as { ordenId: string; codigo: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pedidos-woocommerce'] });
      qc.invalidateQueries({ queryKey: ['pedidos-woocommerce', pedidoId] });
      qc.invalidateQueries({ queryKey: ['ordenes'] });
    },
  });
}
