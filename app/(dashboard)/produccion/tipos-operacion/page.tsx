/**
 * /produccion/tipos-operacion — Catálogo de tipos de operación (BOM y planta)
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ChevronLeft, Plus, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { TipoOperacionSchema, type TipoOperacionInput } from '@/lib/validations/produccion.schema';
import { useTiposOperacion, useCrearTipoOperacion, useActualizarTipoOperacion } from '@/hooks/useTiposOperacion';
import type { TipoOperacion } from '@/types/metalmac.types';

function FilaTipoOperacion({ tipoOperacion }: { tipoOperacion: TipoOperacion }) {
  const actualizar = useActualizarTipoOperacion(tipoOperacion.id);

  async function toggleActivo() {
    try {
      await actualizar.mutateAsync({ activo: !tipoOperacion.activo });
    } catch (e: any) {
      toast.error(e.message ?? 'Error al actualizar el tipo de operación');
    }
  }

  return (
    <TableRow>
      <TableCell className="text-sm">{tipoOperacion.nombre}</TableCell>
      <TableCell>
        <Badge variant={tipoOperacion.activo ? 'default' : 'secondary'}>
          {tipoOperacion.activo ? 'Activo' : 'Inactivo'}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <Button size="sm" variant="outline" disabled={actualizar.isPending} onClick={toggleActivo}>
          {actualizar.isPending
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : tipoOperacion.activo ? 'Desactivar' : 'Activar'}
        </Button>
      </TableCell>
    </TableRow>
  );
}

function NuevoTipoOperacionForm({ onCreado }: { onCreado: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const crear = useCrearTipoOperacion();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<TipoOperacionInput>({
    resolver: zodResolver(TipoOperacionSchema),
    defaultValues: { activo: true },
  });

  const onSubmit = async (data: TipoOperacionInput) => {
    try {
      await crear.mutateAsync(data);
      toast.success('Tipo de operación creado');
      reset();
      setAbierto(false);
      onCreado();
    } catch (e: any) {
      toast.error(e.message ?? 'Error al crear el tipo de operación');
    }
  };

  if (!abierto) {
    return (
      <Button onClick={() => setAbierto(true)}>
        <Plus className="mr-2 h-4 w-4" /> Nuevo tipo de operación
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex items-end gap-3 rounded-md border p-4">
      <div className="space-y-1.5">
        <Label htmlFor="nombre">Nombre</Label>
        <Input id="nombre" placeholder="Corte plasma, Pintura, Perforado…" {...register('nombre')} />
        {errors.nombre && <p className="text-xs text-red-500">{errors.nombre.message}</p>}
      </div>
      <Button type="submit" disabled={crear.isPending}>
        {crear.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Crear'}
      </Button>
      <Button type="button" variant="outline" onClick={() => setAbierto(false)}>
        Cancelar
      </Button>
    </form>
  );
}

export default function TiposOperacionPage() {
  const { data: tiposOperacion, isLoading, refetch } = useTiposOperacion();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/produccion"><ChevronLeft className="h-4 w-4" /></Link>
        </Button>
        <h1 className="text-2xl font-semibold">Tipos de operación</h1>
      </div>

      <NuevoTipoOperacionForm onCreado={() => refetch()} />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !tiposOperacion || tiposOperacion.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay tipos de operación registrados.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead className="w-28">Estado</TableHead>
              <TableHead className="w-32 text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tiposOperacion.map((tipoOperacion) => (
              <FilaTipoOperacion key={tipoOperacion.id} tipoOperacion={tipoOperacion} />
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
