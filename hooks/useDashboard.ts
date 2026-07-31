'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';

export interface DashboardKPIs {
  generadoEn: string;
  data: {
    inventario: {
      materialesBajoStock: number;
      materialIdsAlerta: string[];
    };
    produccion: {
      opsBorrador: number;
      opsEnProceso: number;
      opsCompletadasHoy: number;
      opsVencidas: number;
      totalActivas: number;
    };
    contabilidad: {
      facturasPendientes: number;
      montoPendiente: number;
      facturasUltimas5: Array<{
        id: string;
        numeroFactura: string;
        razonSocialProveedor: string | null;
        total: number;
      }>;
    };
    proyectos: {
      proyectosActivos: number;
      presupuestoTotalActivos: number;
      ejecutadoTotalActivos: number;
      proyectosEnRiesgo: number;
      detalleRiesgo: Array<{
        id: string;
        codigo: string;
        nombre: string;
        cliente: string;
        presupuesto: number;
        costoReal: number;
      }>;
    };
  };
}

export function useDashboardKPIs() {
  const { token } = useAuth();
  return useQuery<DashboardKPIs>({
    queryKey: ['dashboard', 'kpis'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/kpis', {
        headers: { Authorization: `Bearer ${token ?? ''}` },
      });
      if (!res.ok) throw new Error('Error al cargar KPIs');
      return res.json();
    },
    enabled: !!token,
    staleTime: 2 * 60_000,   // 2 minutos
    refetchInterval: 2 * 60_000,
  });
}
