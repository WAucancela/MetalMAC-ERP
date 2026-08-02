/**
 * /contabilidad/centros-costo — Catálogo de centros de costo
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

import { CentroCostoSchema, type CentroCostoInput } from '@/lib/validations/centros-costo.schema';
import { useCentrosCosto, useCrearCentroCosto, useActualizarCentroCosto } from '@/hooks/useCentrosCosto';
import type { CentroCosto } from '@/types/metalmac.types';

function FilaCentroCosto({ centro }: { centro: CentroCosto }) {
  const actualizar = useActualizarCentroCosto(centro.id);

  async function toggleActivo() {
    try {
      await actualizar.mutateAsync({ activo: !centro.activo });
    } catch (e: any) {
      toast.error(e.message ?? 'Error al actualizar centro de costo');
    }
  }

  return (
    <TableRow>
      <TableCell className="font-mono text-sm">{centro.codigo}</TableCell>
      <TableCell className="text-sm">{centro.nombre}</TableCell>
      <TableCell>
        <Badge variant={centro.activo ? 'default' : 'secondary'}>
          {centro.activo ? 'Activo' : 'Inactivo'}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <Button size="sm" variant="outline" disabled={actualizar.isPending} onClick={toggleActivo}>
          {actualizar.isPending
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : centro.activo ? 'Desactivar' : 'Activar'}
        </Button>
      </TableCell>
    </TableRow>
  );
}

function NuevoCentroCostoForm({ onCreado }: { onCreado: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const crear = useCrearCentroCosto();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CentroCostoInput>({
    resolver: zodResolver(CentroCostoSchema),
    defaultValues: { activo: true },
  });

  const onSubmit = async (data: CentroCostoInput) => {
    try {
      await crear.mutateAsync(data);
      toast.success('Centro de costo creado');
      reset();
      setAbierto(false);
      onCreado();
    } catch (e: any) {
      toast.error(e.message ?? 'Error al crear centro de costo');
    }
  };

  if (!abierto) {
    return (
      <Button onClick={() => setAbierto(true)}>
        <Plus className="mr-2 h-4 w-4" /> Nuevo centro de costo
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex items-end gap-3 rounded-md border p-4">
      <div className="space-y-1.5">
        <Label htmlFor="codigo">Código</Label>
        <Input id="codigo" placeholder="PROD" className="w-32" {...register('codigo')} />
        {errors.codigo && <p className="text-xs text-red-500">{errors.codigo.message}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="nombre">Nombre</Label>
        <Input id="nombre" placeholder="Producción" {...register('nombre')} />
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

export default function CentrosCostoPage() {
  const { data: centros, isLoading, refetch } = useCentrosCosto();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/contabilidad"><ChevronLeft className="h-4 w-4" /></Link>
        </Button>
        <h1 className="text-2xl font-semibold">Centros de costo</h1>
      </div>

      <NuevoCentroCostoForm onCreado={() => refetch()} />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !centros || centros.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay centros de costo registrados.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Código</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead className="w-28">Estado</TableHead>
              <TableHead className="w-32 text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {centros.map((centro) => (
              <FilaCentroCosto key={centro.id} centro={centro} />
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
