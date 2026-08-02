/**
 * useCertificadoFirma — React Query hooks para el certificado de firma electrónica
 * (Configuración → Certificado de firma, restringido a GERENTE).
 */

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export interface EstadoCertificadoFirma {
  vigenciaHasta: string | null;
  subidoEn: string | null;
}

export function useCertificadoFirma() {
  const { token } = useAuth();

  return useQuery<EstadoCertificadoFirma>({
    queryKey: ['certificado-firma'],
    queryFn: async () => {
      const res = await fetch('/api/config/certificado-firma', {
        headers: authHeaders(token ?? ''),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      return json.data;
    },
    enabled: !!token,
  });
}

export function useSubirCertificadoFirma() {
  const { token } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ file, password }: { file: File; password: string }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('password', password);

      const res = await fetch('/api/config/certificado-firma', {
        method: 'POST',
        headers: authHeaders(token ?? ''),
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      return json.data as { vigenciaHasta: string };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['certificado-firma'] }),
  });
}
