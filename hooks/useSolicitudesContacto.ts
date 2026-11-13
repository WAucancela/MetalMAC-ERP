/**
 * useSolicitudesContacto — React Query hooks para la bandeja de leads del formulario
 * "Cotizar mi Proyecto" de tallermac-web.
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import type { ActualizarEstadoSolicitudInput } from '@/lib/validations/solicitudes-contacto.schema';
import type { SolicitudContacto } from '@/types/metalmac.types';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export function useSolicitudesContacto(params?: {
  estado?: SolicitudContacto['estado'];
  enabled?: boolean;
}) {
  const { token } = useAuth();
  const sp = new URLSearchParams();
  if (params?.estado) sp.set('estado', params.estado);

  return useQuery<SolicitudContacto[]>({
    queryKey: ['solicitudes-contacto', params],
    queryFn: async () => {
      const res = await fetch(`/api/solicitudes-contacto?${sp.toString()}`, {
        headers: authHeaders(token ?? ''),
      });
      if (!res.ok) throw new Error('Error al cargar solicitudes');
      const json = await res.json();
      return json.data;
    },
    // Igual criterio que usePedidosTienda: el llamador (Sidebar) pasa `enabled:
    // false` para roles sin permiso, para no disparar un 403 en cada carga.
    enabled: !!token && (params?.enabled ?? true),
    staleTime: 30_000,
  });
}

export function useSolicitudContacto(id: string | null) {
  const { token } = useAuth();
  return useQuery<SolicitudContacto>({
    queryKey: ['solicitudes-contacto', id],
    queryFn: async () => {
      const res = await fetch(`/api/solicitudes-contacto/${id}`, {
        headers: authHeaders(token ?? ''),
      });
      if (!res.ok) throw new Error('Error al cargar solicitud');
      const json = await res.json();
      return json.data;
    },
    enabled: !!token && !!id,
  });
}

export function useActualizarEstadoSolicitud(id: string) {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: ActualizarEstadoSolicitudInput) => {
      const res = await fetch(`/api/solicitudes-contacto/${id}`, {
        method: 'PATCH',
        headers: { ...authHeaders(token ?? ''), 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al actualizar solicitud');
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['solicitudes-contacto'] });
      qc.invalidateQueries({ queryKey: ['solicitudes-contacto', id] });
    },
  });
}
