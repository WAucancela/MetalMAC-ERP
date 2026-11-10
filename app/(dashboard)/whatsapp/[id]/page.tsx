/**
 * /whatsapp/[id] — Hilo de una conversación de WhatsApp: mensajes del
 * cliente, respuestas del agente, y las acciones que tomó (búsquedas en el
 * catálogo, cotizaciones creadas) intercaladas como notas de sistema.
 * Sólo lectura.
 */
'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, MessageCircle, Phone, FileText, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useConversacionWhatsApp } from '@/hooks/useWhatsapp';
import type { MensajeConversacionWhatsApp } from '@/types/metalmac.types';

function formatFecha(fecha: string): string {
  try { return format(parseISO(fecha), "dd MMM yyyy, HH:mm", { locale: es }); } catch { return fecha; }
}

function Burbuja({ mensaje }: { mensaje: MensajeConversacionWhatsApp }) {
  if (mensaje.rol === 'SISTEMA') {
    return (
      <div className="flex justify-center">
        <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">{mensaje.texto}</span>
      </div>
    );
  }

  const esCliente = mensaje.rol === 'CLIENTE';
  return (
    <div className={cn('flex', esCliente ? 'justify-start' : 'justify-end')}>
      <div
        className={cn(
          'max-w-[75%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm',
          esCliente ? 'bg-muted text-foreground' : 'bg-primary text-primary-foreground',
        )}
      >
        {mensaje.texto}
      </div>
    </div>
  );
}

export default function ConversacionWhatsAppPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading } = useConversacionWhatsApp(id);

  return (
    <div className="space-y-6 p-6">
      <button
        onClick={() => router.push('/whatsapp')}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a WhatsApp
      </button>

      {isLoading || !data ? (
        <div className="space-y-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold">
                <MessageCircle className="h-6 w-6 text-muted-foreground" />
                {data.nombreContacto || data.telefono}
              </h1>
              <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                <Phone className="h-3.5 w-3.5" /> {data.telefono}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge variant={data.estado === 'ACTIVA' ? 'default' : 'secondary'}>
                {data.estado === 'ACTIVA' ? 'Activa' : 'Cerrada'}
              </Badge>
              <p className="text-xs text-muted-foreground">Actualizada {formatFecha(data.actualizadoEn)}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 text-sm">
            {data.clienteId && (
              <Link href={`/clientes/${data.clienteId}`} className="flex items-center gap-1 text-primary hover:underline">
                <Users className="h-4 w-4" /> Ver ficha de cliente
              </Link>
            )}
            {data.cotizacionBorradorId && (
              <Link href={`/contabilidad/cotizaciones/${data.cotizacionBorradorId}`} className="flex items-center gap-1 text-primary hover:underline">
                <FileText className="h-4 w-4" /> Ver cotización en borrador
              </Link>
            )}
          </div>

          <div className="space-y-3 rounded-md border bg-background p-4">
            {data.mensajes.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Sin mensajes todavía</p>
            ) : (
              data.mensajes.map((m, i) => <Burbuja key={i} mensaje={m} />)
            )}
          </div>
        </>
      )}
    </div>
  );
}
