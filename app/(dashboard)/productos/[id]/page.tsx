/**
 * /productos/[id] — Detalle de Producto + BOM editable
 */

'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ChevronLeft, Package, Loader2 } from 'lucide-react';

import { Button }  from '@/components/ui/button';
import { Badge }   from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { BOMTable } from '@/components/produccion/BOMTable';
import { useProducto } from '@/hooks/useProductos';
import { useBOM } from '@/hooks/useBOM';

// Para pasar al BOMTable necesitamos los catálogos de materiales y unidades
import { useMateriales } from '@/hooks/useInventario';
import { useUnidades } from '@/hooks/useInventario';

export default function ProductoDetallePage() {
  const { id } = useParams<{ id: string }>();
  const { data: productoData, isLoading: loadingProducto } = useProducto(id);
  const { data: bomData, isLoading: loadingBOM } = useBOM(id);
  const { data: materiales = [] } = useMateriales({ activo: true });
  const { data: unidades = [] } = useUnidades();

  if (loadingProducto) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const producto = productoData?.producto;
  if (!producto) return <p className="text-sm text-muted-foreground">Producto no encontrado.</p>;

  // Mapear materiales para BOMTable
  const materialesOpciones = materiales.map((m: any) => ({
    id: m.id,
    nombre: m.nombre,
    codigo: m.codigoInterno ?? m.codigo,
    precioUnitario: m.costoUnitario,  // Material usa costoUnitario
  }));

  const unidadesOpciones = unidades.map((u: any) => ({
    id: u.id,
    nombre: u.nombre,
    simbolo: u.simbolo ?? u.nombre,
  }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/productos"><ChevronLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{producto.nombre}</h1>
            <Badge variant={producto.tipo === 'PRODUCTO_TERMINADO' ? 'default' : 'secondary'}>
              {producto.tipo === 'PRODUCTO_TERMINADO' ? 'Terminado' : 'Semielaborado'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Código: <span className="font-mono">{producto.codigo}</span>
            {' · '}
            Precio venta: <span className="tabular-nums">${producto.precioVenta?.toFixed(2)}</span>
            {' · '}
            Unidad: {producto.unidadVenta}
          </p>
          {producto.descripcion && (
            <p className="text-sm mt-2">{producto.descripcion}</p>
          )}
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/produccion/nueva?productoId=${id}`}>
            <Package className="mr-2 h-4 w-4" /> Nueva OP
          </Link>
        </Button>
      </div>

      {/* BOM */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Bill of Materials (BOM)</h2>
        {loadingBOM ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <BOMTable
            productoId={id}
            initialData={bomData?.bom ?? undefined}
            materiales={materialesOpciones}
            unidades={unidadesOpciones}
          />
        )}
      </div>
    </div>
  );
}
