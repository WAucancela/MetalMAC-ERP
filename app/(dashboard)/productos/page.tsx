/**
 * /productos — Catálogo de Productos Terminados y Semielaborados
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Search } from 'lucide-react';

import { Button }  from '@/components/ui/button';
import { Input }   from '@/components/ui/input';
import { Badge }   from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useProductos } from '@/hooks/useProductos';

export default function ProductosPage() {
  const [q, setQ]      = useState('');
  const [tipo, setTipo] = useState<'PRODUCTO_TERMINADO' | 'SEMIELABORADO' | ''>('');
  const [estado, setEstado] = useState<'true' | 'false' | ''>('true');

  const { data: productos = [], isLoading } = useProductos({
    tipo: tipo || undefined,
    activo: estado === '' ? undefined : estado === 'true',
    q: q || undefined,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Productos</h1>
        <Button asChild>
          <Link href="/productos/nuevo">
            <Plus className="mr-2 h-4 w-4" /> Nuevo Producto
          </Link>
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar por nombre o código…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {(['', 'PRODUCTO_TERMINADO', 'SEMIELABORADO'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTipo(t)}
              className={`rounded-full px-3 py-1 text-sm border transition-colors ${
                tipo === t
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-input hover:bg-muted'
              }`}
            >
              {t === '' ? 'Todos' : t === 'PRODUCTO_TERMINADO' ? 'Terminados' : 'Semielaborados'}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {([['true', 'Activos'], ['false', 'Inactivos'], ['', 'Todos']] as const).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setEstado(value)}
              className={`rounded-full px-3 py-1 text-sm border transition-colors ${
                estado === value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-input hover:bg-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : productos.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">No se encontraron productos.</p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/productos/nuevo">Crear primer producto</Link>
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="w-24">Unidad venta</TableHead>
              <TableHead className="w-28 text-right">Precio venta</TableHead>
              <TableHead className="w-20">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {productos.map((p) => (
              <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50">
                <TableCell>
                  <Link href={`/productos/${p.id}`} className="font-mono text-sm font-medium hover:underline">
                    {p.codigo}
                  </Link>
                </TableCell>
                <TableCell className="text-sm">{p.nombre}</TableCell>
                <TableCell>
                  <Badge variant={p.tipo === 'PRODUCTO_TERMINADO' ? 'default' : 'secondary'}>
                    {p.tipo === 'PRODUCTO_TERMINADO' ? 'Terminado' : 'Semielaborado'}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{p.unidadVenta}</TableCell>
                <TableCell className="text-right tabular-nums text-sm">
                  ${p.precioVenta.toFixed(2)}
                </TableCell>
                <TableCell>
                  <Badge variant={p.activo ? 'secondary' : 'outline'} className={p.activo ? '' : 'text-muted-foreground'}>
                    {p.activo ? 'Activo' : 'Inactivo'}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
