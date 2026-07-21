/**
 * /proveedores
 *
 * Lista de proveedores con búsqueda y botón de crear.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Building2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import ProveedorForm from '@/components/proveedores/ProveedorForm';
import { useProveedores } from '@/hooks/useProveedores';

export default function ProveedoresPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data: proveedores, isLoading } = useProveedores({
    activo: true,
    q: search || undefined,
  });

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Proveedores</h1>
          <p className="text-sm text-muted-foreground">
            Directorio de proveedores activos
          </p>
        </div>
        <Button onClick={() => setSheetOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo proveedor
        </Button>
      </div>

      {/* Búsqueda */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por razón social o RUC…"
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
      ) : !proveedores?.length ? (
        <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
          <Building2 className="h-10 w-10" />
          <p className="text-sm">
            {search ? 'No se encontraron proveedores con ese criterio' : 'No hay proveedores registrados'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs font-medium text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Razón Social</th>
                <th className="px-4 py-3 text-left">RUC</th>
                <th className="px-4 py-3 text-left">Ciudad</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-right">Crédito</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {proveedores.map((p) => (
                <tr
                  key={p.id}
                  className="hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => router.push(`/proveedores/${p.id}`)}
                >
                  <td className="px-4 py-3 font-medium">{p.razonSocial}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.ruc}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.ciudad}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-xs">
                      {p.tipoContribuyente.replace('_', ' ')}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">{p.diasCredito}d</td>
                  <td className="px-4 py-3 text-right">
                    {p.contribuyenteEspecial && (
                      <Badge className="text-xs bg-purple-100 text-purple-700 hover:bg-purple-100">
                        Especial
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Sheet nuevo proveedor */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Nuevo proveedor</SheetTitle>
            <SheetDescription>Completa los datos del proveedor</SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <ProveedorForm
              onSuccess={() => setSheetOpen(false)}
              onCancel={() => setSheetOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
