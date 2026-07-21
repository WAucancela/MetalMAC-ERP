/**
 * useStock — hooks para consultar stock y alertas.
 */
'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import type { Stock } from '@/types/metalmac.types';
import type { AlertaStockBajo } from '@/lib/services/inventario.service';

async function apiFetch<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message);
  return json.data as T;
}

export function useStock() {
  const { token } = useAuth();
  return useQuery({
    queryKey: ['stock'],
    enabled:  !!token,
    queryFn:  () => apiFetch<Stock[]>('/api/inventario/stock', token!),
    staleTime: 60_000,
  });
}

export function useAlertasStockBajo() {
  const { token } = useAuth();
  return useQuery({
    queryKey: ['stock', 'alertas'],
    enabled:  !!token,
    queryFn:  () =>
      apiFetch<AlertaStockBajo[]>('/api/inventario/stock?alertas=1', token!),
    staleTime: 30_000,
    refetchInterval: 5 * 60_000, // re-chequea cada 5 minutos
  });
}
