/**
 * hooks/useReportes.ts — React Query hooks para los reportes que necesitan
 * una vista previa en pantalla además del CSV (ej. comparar canales de venta).
 * Los otros reportes de /reportes son CSV-only vía ExportButton y no necesitan hook.
 */
'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import type { ResumenCotizacionesPorOrigen } from '@/lib/services/reportes.service';

export function useResumenCotizacionesPorOrigen(params: { desde: string; hasta: string }) {
  const { token } = useAuth();
  const sp = new URLSearchParams({ format: 'json', desde: params.desde, hasta: params.hasta });

  return useQuery<ResumenCotizacionesPorOrigen[]>({
    queryKey: ['reportes', 'cotizaciones-por-origen', params],
    queryFn: async () => {
      const res = await fetch(`/api/reportes/cotizaciones-por-origen?${sp.toString()}`, {
        headers: { Authorization: `Bearer ${token ?? ''}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      return json.data as ResumenCotizacionesPorOrigen[];
    },
    enabled: !!token,
  });
}
