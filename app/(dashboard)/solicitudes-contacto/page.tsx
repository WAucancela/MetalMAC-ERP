'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { Badge }    from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useSolicitudesContacto } from '@/hooks/useSolicitudesContacto';
import type { EstadoSolicitudContacto } from '@/types/metalmac.types';

const ESTADO_VARIANT: Record<EstadoSolicitudContacto, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  NUEVA:       'default',
  CONTACTADA:  'outline',
  DESCARTADA:  'destructive',
};

const ESTADOS: Array<{ value: EstadoSolicitudContacto | ''; label: string }> = [
  { value: '',            label: 'Todos' },
  { value: 'NUEVA',       label: 'Nuevas' },
  { value: 'CONTACTADA',  label: 'Contactadas' },
  { value: 'DESCARTADA',  label: 'Descartadas' },
];

export default function SolicitudesContactoPage() {
  const [estado, setEstado] = useState<EstadoSolicitudContacto | ''>('NUEVA');
  const { data: solicitudes = [], isLoading } = useSolicitudesContacto(
    estado ? { estado } : undefined,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Solicitudes de Contacto</h1>
          <p className="text-sm text-muted-foreground">Leads de &quot;Cotizar mi Proyecto&quot; recibidos desde tallermac.com</p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {ESTADOS.map((e) => (
          <button
            key={e.value}
            onClick={() => setEstado(e.value)}
            className={`rounded-full px-3 py-1 text-sm border transition-colors ${
              estado === e.value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background border-input hover:bg-muted'
            }`}
          >
            {e.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : solicitudes.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">No hay solicitudes en este estado.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Servicio de interés</TableHead>
              <TableHead className="w-40">Recibida</TableHead>
              <TableHead className="w-32">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {solicitudes.map((s) => (
              <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50">
                <TableCell>
                  <Link href={`/solicitudes-contacto/${s.id}`} className="text-sm font-medium hover:underline">
                    {s.nombre}
                  </Link>
                  <p className="text-xs text-muted-foreground">{s.email}</p>
                </TableCell>
                <TableCell className="text-sm">{s.servicioInteres || '—'}</TableCell>
                <TableCell className="text-sm">
                  {format(new Date(s.creadoEn), 'dd MMM yyyy HH:mm', { locale: es })}
                </TableCell>
                <TableCell>
                  <Badge variant={ESTADO_VARIANT[s.estado]}>{s.estado}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
