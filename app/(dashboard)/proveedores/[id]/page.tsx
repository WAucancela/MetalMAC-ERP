/**
 * /proveedores/[id]
 *
 * Detalle de un proveedor:
 * - Info general + métricas
 * - Últimas 10 facturas de compra
 * - Botón editar (abre Sheet)
 */

'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, Building2, Phone, Mail, MapPin, Edit2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import FacturaTable from '@/components/contabilidad/FacturaTable';
import ProveedorForm from '@/components/proveedores/ProveedorForm';
import { useProveedor, useEliminarProveedor } from '@/hooks/useProveedores';

export default function ProveedorDetallePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [editSheetOpen, setEditSheetOpen] = useState(false);

  const { data, isLoading } = useProveedor(id);
  const eliminar = useEliminarProveedor();

  const handleEliminar = async () => {
    if (!confirm('¿Desactivar este proveedor?')) return;
    try {
      await eliminar.mutateAsync(id);
      toast.success('Proveedor desactivado');
      router.push('/proveedores');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 p-6">
        <Building2 className="h-10 w-10 text-muted-foreground" />
        <p className="text-muted-foreground">Proveedor no encontrado</p>
        <Button variant="outline" onClick={() => router.push('/proveedores')}>
          Volver a proveedores
        </Button>
      </div>
    );
  }

  const { proveedor } = data;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/proveedores')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{proveedor.razonSocial}</h1>
            <p className="text-sm text-muted-foreground font-mono">{proveedor.ruc}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditSheetOpen(true)}>
            <Edit2 className="mr-2 h-3.5 w-3.5" />
            Editar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={handleEliminar}
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            Desactivar
          </Button>
        </div>
      </div>

      {/* Info card */}
      <div className="rounded-lg border p-5 space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{proveedor.tipoContribuyente.replace('_', ' ')}</Badge>
          {proveedor.contribuyenteEspecial && (
            <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">Contrib. Especial</Badge>
          )}
          {proveedor.obligaContabilidad && (
            <Badge variant="secondary">Obliga Contabilidad</Badge>
          )}
          {proveedor.agenteRetencion && (
            <Badge variant="secondary">Agente Retención</Badge>
          )}
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="h-4 w-4" />
            <span>{proveedor.telefonoPrincipal}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="h-4 w-4" />
            <span>{proveedor.emailPrincipal}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span>{proveedor.ciudad}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="font-medium text-foreground">{proveedor.diasCredito} días</span>
            <span>de crédito</span>
          </div>
        </div>
      </div>

      {/* Facturas */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Facturas de compra</h2>
        <FacturaTable proveedorId={id} />
      </div>

      {/* Sheet editar */}
      <Sheet open={editSheetOpen} onOpenChange={setEditSheetOpen}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Editar proveedor</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            <ProveedorForm
              proveedor={proveedor}
              onSuccess={() => setEditSheetOpen(false)}
              onCancel={() => setEditSheetOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
