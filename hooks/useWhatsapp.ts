/**
 * hooks/useWhatsapp.ts — React Query hooks para ver (sólo lectura) las
 * conversaciones del agente de ventas de WhatsApp desde el dashboard.
 */
'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import type { ConversacionWhatsApp, ConversacionWhatsAppResumen } from '@/types/metalmac.types';

const BASE = '/api/whatsapp/conversaciones';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function apiFetch<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, { headers: authHeaders(token) });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json.data as T;
}

export interface ConversacionesWhatsAppPaginadas {
  items: ConversacionWhatsAppResumen[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function useConversacionesWhatsApp(params: {
  estado?: 'ACTIVA' | 'CERRADA';
  q?: string;
  page: number;
  limit: number;
}) {
  const { token } = useAuth();
  const sp = new URLSearchParams();
  if (params.estado) sp.set('estado', params.estado);
  if (params.q)      sp.set('q', params.q);
  sp.set('page',  String(params.page));
  sp.set('limit', String(params.limit));

  return useQuery<ConversacionesWhatsAppPaginadas>({
    queryKey: ['whatsapp-conversaciones', 'paginado', params],
    queryFn: async () => {
      const res = await fetch(`${BASE}?${sp.toString()}`, { headers: authHeaders(token ?? '') });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      const total = json.total ?? json.data.length;
      return {
        items: json.data as ConversacionWhatsAppResumen[],
        total,
        page: params.page,
        limit: params.limit,
        totalPages: Math.max(1, Math.ceil(total / params.limit)),
      };
    },
    enabled: !!token,
    // Refresca sola — es una bandeja de mensajes entrantes, no algo que el
    // staff recargue a mano para ver si llegó algo nuevo.
    refetchInterval: 30_000,
  });
}

export function useConversacionWhatsApp(id: string) {
  const { token } = useAuth();
  return useQuery<ConversacionWhatsApp>({
    queryKey: ['whatsapp-conversaciones', id],
    queryFn: () => apiFetch<ConversacionWhatsApp>(`${BASE}/${id}`, token ?? ''),
    enabled: !!token && !!id,
    refetchInterval: 15_000,
  });
}
