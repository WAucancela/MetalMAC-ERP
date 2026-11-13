/**
 * /solicitudes-contacto/[id] — Detalle de una solicitud de contacto de tallermac.com
 */

'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { ChevronLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useSolicitudContacto, useActualizarEstadoSolicitud } from '@/hooks/useSolicitudesContacto';
import type { EstadoSolicitudContacto } from '@/types/metalmac.types';

const ESTADO_VARIANT: Record<EstadoSolicitudContacto, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  NUEVA:       'default',
  CONTACTADA:  'outline',
  DESCARTADA:  'destructive',
};

export default function SolicitudContactoDetallePage() {
  const { id } = useParams<{ id: string }>();
  const { data: solicitud, isLoading } = useSolicitudContacto(id);
  const actualizarEstado = useActualizarEstadoSolicitud(id);

  async function marcar(estado: 'CONTACTADA' | 'DESCARTADA') {
    try {
      await actualizarEstado.mutateAsync({ estado });
      toast.success(estado === 'CONTACTADA' ? 'Solicitud marcada como contactada' : 'Solicitud descartada');
    } catch (e: any) {
      toast.error(e.message ?? 'Error al actualizar solicitud');
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!solicitud) return <p className="text-sm text-muted-foreground">Solicitud no encontrada.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/solicitudes-contacto"><ChevronLeft className="h-4 w-4" /></Link>
        </Button>
        <h1 className="text-2xl font-semibold">{solicitud.nombre}</h1>
        <Badge variant={ESTADO_VARIANT[solicitud.estado]}>{solicitud.estado}</Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: 'Correo', value: solicitud.email || '—' },
          { label: 'Teléfono', value: solicitud.telefono || '—' },
          { label: 'Servicio de interés', value: solicitud.servicioInteres || '—' },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className="text-sm font-medium mt-1">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border p-4 space-y-2">
        <p className="text-xs text-muted-foreground">Descripción del proyecto</p>
        <p className="text-sm whitespace-pre-wrap">{solicitud.descripcion || 'Sin descripción.'}</p>
      </div>

      {solicitud.estado === 'NUEVA' && (
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => marcar('CONTACTADA')} disabled={actualizarEstado.isPending}>
            Marcar como contactada
          </Button>
          <Button variant="destructive" onClick={() => marcar('DESCARTADA')} disabled={actualizarEstado.isPending}>
            Descartar
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Recibida el {format(new Date(solicitud.creadoEn), "dd MMM yyyy 'a las' HH:mm", { locale: es })}
      </p>
    </div>
  );
}
