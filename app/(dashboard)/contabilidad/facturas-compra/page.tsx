/**
 * /contabilidad/facturas-compra
 *
 * Lista de facturas de compra con:
 * - Botón de upload de XML → abre Sheet con FacturaUploader
 * - FacturaTable con filtros
 * - Stats rápidas: total del mes, pendientes
 */

'use client';

import { useState } from 'react';
import { Plus, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import FacturaUploader from '@/components/contabilidad/FacturaUploader';
import FacturaTable from '@/components/contabilidad/FacturaTable';
import { useProveedores } from '@/hooks/useProveedores';
import { useFacturas } from '@/hooks/useFacturas';

export default function FacturasCompraPage() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedProveedorId, setSelectedProveedorId] = useState<string>('');
  const [proveedorFilter, setProveedorFilter] = useState<string>('');

  const { data: proveedores } = useProveedores({ activo: true });
  const { data: todasFacturas } = useFacturas({});

  // Stats rápidas
  const pendientes = todasFacturas?.filter((f) => f.estado === 'PENDIENTE').length ?? 0;
  const totalMes = todasFacturas?.reduce((acc, f) => acc + f.total, 0) ?? 0;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Facturas de Compra</h1>
          <p className="text-sm text-muted-foreground">
            Registra y gestiona las facturas de proveedores
          </p>
        </div>
        <Button onClick={() => setSheetOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Subir XML
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border p-4 space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total registrado</p>
          <p className="text-2xl font-bold">${totalMes.toFixed(2)}</p>
        </div>
        <div className="rounded-lg border p-4 space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Pendientes</p>
          <p className="text-2xl font-bold text-amber-600">{pendientes}</p>
        </div>
        <div className="rounded-lg border p-4 space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total facturas</p>
          <p className="text-2xl font-bold">{todasFacturas?.length ?? 0}</p>
        </div>
      </div>

      {/* Filtro por proveedor */}
      {proveedores && proveedores.length > 0 && (
        <Select value={proveedorFilter} onValueChange={setProveedorFilter}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Filtrar por proveedor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos los proveedores</SelectItem>
            {proveedores.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.razonSocial}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Tabla */}
      <FacturaTable proveedorId={proveedorFilter || undefined} />

      {/* Sheet de upload */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Registrar factura de compra
            </SheetTitle>
            <SheetDescription>
              Sube el XML del SRI para registrar automáticamente la factura
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            {/* Selección de proveedor */}
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Proveedor *</p>
              <Select value={selectedProveedorId} onValueChange={setSelectedProveedorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona el proveedor" />
                </SelectTrigger>
                <SelectContent>
                  {proveedores?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.razonSocial} — {p.ruc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedProveedorId ? (
              <FacturaUploader
                proveedorId={selectedProveedorId}
                onSuccess={(id) => {
                  toast.success('Factura registrada');
                  setSheetOpen(false);
                  setSelectedProveedorId('');
                }}
                onCancel={() => setSheetOpen(false)}
              />
            ) : (
              <div className="rounded-md bg-muted/50 p-6 text-center text-sm text-muted-foreground">
                Selecciona un proveedor para continuar
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
