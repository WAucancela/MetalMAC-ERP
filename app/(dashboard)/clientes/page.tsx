/**
 * /clientes — Directorio unificado de clientes (base del CRM liviano).
 */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Plus, Users, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import ClienteForm from '@/components/clientes/ClienteForm';
import { useClientesPaginados } from '@/hooks/useClientes';

const PAGE_SIZE = 50;

export default function ClientesPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [search]);

  const { data, isLoading } = useClientesPaginados({
    activo: true,
    q: search || undefined,
    page,
    limit: PAGE_SIZE,
  });

  const clientes    = data?.items ?? [];
  const total       = data?.total ?? 0;
  const totalPages  = data?.totalPages ?? 1;
  const desde       = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const hasta       = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            Directorio unificado — cotizaciones, proyectos, facturas y pedidos web en un solo lugar
          </p>
        </div>
        <Button onClick={() => setSheetOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo cliente
        </Button>
      </div>

      {/* Búsqueda */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, RUC/cédula o email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : clientes.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
          <Users className="h-10 w-10" />
          <p className="text-sm">
            {search ? 'No se encontraron clientes con ese criterio' : 'No hay clientes registrados'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs font-medium text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Razón Social</th>
                <th className="px-4 py-3 text-left">Identificación</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Teléfono</th>
                <th className="px-4 py-3 text-left">Ciudad</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {clientes.map((c) => (
                <tr
                  key={c.id}
                  className="hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => router.push(`/clientes/${c.id}`)}
                >
                  <td className="px-4 py-3 font-medium">{c.razonSocial}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{c.identificacion ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.email || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.telefono || c.whatsapp || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.ciudad || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginación */}
      {!isLoading && total > 0 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Mostrando {desde}–{hasta} de {total} cliente{total === 1 ? '' : 's'}
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

      {/* Sheet nuevo cliente */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Nuevo cliente</SheetTitle>
            <SheetDescription>Completa los datos del cliente</SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <ClienteForm
              onSuccess={() => setSheetOpen(false)}
              onCancel={() => setSheetOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
