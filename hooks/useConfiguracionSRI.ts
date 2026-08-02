/**
 * useConfiguracionSRI — React Query hooks para la configuración SRI/Resend
 * (Configuración → SRI / Email, restringido a GERENTE).
 */

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import type { ConfiguracionSRIInput } from '@/lib/validations/configuracion-sri.schema';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export interface EstadoConfiguracionSRI {
  ambiente: 'PRUEBAS' | 'PRODUCCION' | null;
  emisorRuc: string | null;
  emisorRazonSocial: string | null;
  emisorNombreComercial: string | null;
  emisorDirMatriz: string | null;
  emisorDirEstablecimiento: string | null;
  emisorObligadoContabilidad: 'SI' | 'NO' | null;
  resendFromEmail: string | null;
  resendApiKeyConfigurada: boolean;
}

export function useConfiguracionSRI() {
  const { token } = useAuth();

  return useQuery<EstadoConfiguracionSRI>({
    queryKey: ['configuracion-sri'],
    queryFn: async () => {
      const res = await fetch('/api/config/sri', {
        headers: authHeaders(token ?? ''),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      return json.data;
    },
    enabled: !!token,
  });
}

export function useGuardarConfiguracionSRI() {
  const { token } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (data: ConfiguracionSRIInput) => {
      const res = await fetch('/api/config/sri', {
        method: 'PUT',
        headers: { ...authHeaders(token ?? ''), 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      return json;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['configuracion-sri'] }),
  });
}
