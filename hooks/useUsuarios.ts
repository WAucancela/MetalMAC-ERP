/**
 * useUsuarios — React Query hooks para administración de usuarios/roles (solo GERENTE)
 */

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import type { CrearUsuarioInput, ActualizarUsuarioInput } from '@/lib/validations/usuarios.schema';

const BASE = '/api/usuarios';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export interface Usuario {
  id: string;
  email: string;
  rol: 'GERENTE' | 'BODEGUERO' | 'PRODUCCION' | 'CONTABILIDAD';
  activo: boolean;
  creado_en: string;
}

export function useUsuarios() {
  const { token } = useAuth();
  return useQuery<Usuario[]>({
    queryKey: ['usuarios'],
    queryFn: async () => {
      const res = await fetch(BASE, { headers: authHeaders(token ?? '') });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al cargar usuarios');
      return json.data;
    },
    enabled: !!token,
  });
}

export function useCrearUsuario() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CrearUsuarioInput) => {
      const res = await fetch(BASE, {
        method: 'POST',
        headers: { ...authHeaders(token ?? ''), 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al crear usuario');
      return json.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['usuarios'] }),
  });
}

export function useActualizarUsuario(id: string) {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: ActualizarUsuarioInput) => {
      const res = await fetch(`${BASE}/${id}`, {
        method: 'PATCH',
        headers: { ...authHeaders(token ?? ''), 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al actualizar usuario');
      return json;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['usuarios'] }),
  });
}
