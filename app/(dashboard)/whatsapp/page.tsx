/**
 * /whatsapp — Bandeja de conversaciones del agente de ventas de WhatsApp.
 * Sólo lectura: las conversaciones las crea/actualiza el webhook de Meta
 * (app/api/whatsapp/webhook), no el staff desde acá.
 */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, MessageCircle, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useConversacionesWhatsApp } from '@/hooks/useWhatsapp';

const PAGE_SIZE = 50;

function formatFecha(fecha: string): string {
  try { return format(parseISO(fecha), "dd MMM yyyy HH:mm", { locale: es }); } catch { return fecha; }
}

export default function WhatsAppPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState<'TODAS' | 'ACTIVA' | 'CERRADA'>('TODAS');
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [search, estado]);

  const { data, isLoading } = useConversacionesWhatsApp({
    estado: estado === 'TODAS' ? undefined : estado,
    q: search || undefined,
    page,
    limit: PAGE_SIZE,
  });

  const conversaciones = data?.items ?? [];
  const total          = data?.total ?? 0;
  const totalPages     = data?.totalPages ?? 1;
  const desde          = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const hasta          = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">WhatsApp</h1>
        <p className="text-sm text-muted-foreground">
          Conversaciones del agente de ventas — búsquedas y cotizaciones que armó solo
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por número o nombre…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={estado} onValueChange={(v) => setEstado(v as typeof estado)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TODAS">Todas</SelectItem>
            <SelectItem value="ACTIVA">Activas</SelectItem>
            <SelectItem value="CERRADA">Cerradas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : conversaciones.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
          <MessageCircle className="h-10 w-10" />
          <p className="text-sm">
            {search ? 'No se encontraron conversaciones con ese criterio' : 'Todavía no llegó ningún mensaje por WhatsApp'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs font-medium text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Contacto</th>
                <th className="px-4 py-3 text-left">Número</th>
                <th className="px-4 py-3 text-left">Último mensaje</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-left">Actualizada</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {conversaciones.map((c) => (
                <tr
                  key={c.id}
                  className="hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => router.push(`/whatsapp/${c.id}`)}
                >
                  <td className="px-4 py-3 font-medium">{c.nombreContacto || '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{c.telefono}</td>
                  <td className="px-4 py-3 max-w-xs truncate text-muted-foreground">{c.ultimoMensaje || '—'}</td>
                  <td className="px-4 py-3">
                    <Badge variant={c.estado === 'ACTIVA' ? 'default' : 'secondary'}>
                      {c.estado === 'ACTIVA' ? 'Activa' : 'Cerrada'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatFecha(c.actualizadoEn)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!isLoading && total > 0 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Mostrando {desde}–{hasta} de {total} conversación{total === 1 ? '' : 'es'}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Anterior
            </Button>
            <span className="text-sm text-muted-foreground px-1">Página {page} de {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              Siguiente <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
