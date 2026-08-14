/**
 * /contabilidad/cotizaciones/nueva — armar una cotización nueva.
 * Las líneas se pueden insertar del catálogo (productos/materiales, con precio
 * prellenado) o cargar libres (mano de obra, servicios) — en ambos casos quedan
 * editables antes de guardar.
 */
'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { addDays, format } from 'date-fns';
import { ChevronLeft, Plus, Trash2, Loader2, Save } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { CotizacionSchema, type CotizacionInput } from '@/lib/validations/cotizaciones.schema';
import { useCrearCotizacion } from '@/hooks/useCotizaciones';
import { useProductos } from '@/hooks/useProductos';
import { useMateriales } from '@/hooks/useInventario';
import { useProyectos } from '@/hooks/useProyectos';
import { ItemCotizacionCombobox } from '@/components/contabilidad/ItemCotizacionCombobox';

const SIN_PROYECTO = '__sin_proyecto__';
const IVA_ECUADOR = 0.15;

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function NuevaCotizacionPage() {
  const router = useRouter();
  const crear = useCrearCotizacion();
  const { data: productos } = useProductos({ activo: true });
  const { data: materiales } = useMateriales({ activo: true });
  const { data: proyectos } = useProyectos();

  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<CotizacionInput>({
    resolver: zodResolver(CotizacionSchema),
    defaultValues: {
      clienteNombre: '',
      clienteEmail: '',
      clienteWhatsapp: '',
      proyectoId: null,
      fechaEmision: hoyISO(),
      fechaVencimiento: format(addDays(new Date(), 15), 'yyyy-MM-dd'),
      notas: '',
      lineas: [],
    },
  });

  const { fields: lineas, append, remove } = useFieldArray({ control, name: 'lineas' });
  const watchLineas = watch('lineas');

  const subtotal = (watchLineas ?? []).reduce((acc, l) => acc + (l.cantidad || 0) * (l.precioUnitario || 0), 0);
  const iva = subtotal * IVA_ECUADOR;
  const total = subtotal + iva;

  const onSubmit = async (data: CotizacionInput) => {
    try {
      const res = await crear.mutateAsync(data);
      toast.success('Cotización creada');
      router.push(`/contabilidad/cotizaciones/${res.id}`);
    } catch (e: any) {
      toast.error(e.message ?? 'Error al crear la cotización');
    }
  };

  const onInvalid = () => {
    toast.error('Revisá los campos marcados en rojo');
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/contabilidad/cotizaciones"><ChevronLeft className="h-4 w-4" /></Link>
        </Button>
        <h1 className="text-2xl font-semibold">Nueva cotización</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-6">
        {/* Cliente y vigencia */}
        <div className="rounded-lg border p-4 space-y-4">
          <h3 className="text-sm font-semibold">Cliente</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Nombre / Razón social</Label>
              <Input {...register('clienteNombre')} placeholder="Constructora XYZ S.A." />
              {errors.clienteNombre && <p className="text-xs text-red-500">{errors.clienteNombre.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Proyecto (opcional)</Label>
              <Select
                value={watch('proyectoId') ?? SIN_PROYECTO}
                onValueChange={(v) => setValue('proyectoId', v === SIN_PROYECTO ? null : v)}
              >
                <SelectTrigger><SelectValue placeholder="Sin vincular" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={SIN_PROYECTO}>Sin vincular</SelectItem>
                  {(proyectos ?? []).map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.codigo} — {p.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Email (para enviar la cotización)</Label>
              <Input type="email" {...register('clienteEmail')} placeholder="cliente@empresa.com" />
              {errors.clienteEmail && <p className="text-xs text-red-500">{errors.clienteEmail.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>WhatsApp (opcional)</Label>
              <Input {...register('clienteWhatsapp')} placeholder="+593 99 999 9999" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Fecha de emisión</Label>
              <Input type="date" {...register('fechaEmision')} />
              {errors.fechaEmision && <p className="text-xs text-red-500">{errors.fechaEmision.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Válida hasta</Label>
              <Input type="date" {...register('fechaVencimiento')} />
              {errors.fechaVencimiento && <p className="text-xs text-red-500">{errors.fechaVencimiento.message}</p>}
            </div>
          </div>
        </div>

        {/* Líneas */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Ítems</h3>
            <div className="flex gap-2">
              <ItemCotizacionCombobox
                productos={productos ?? []}
                materiales={materiales ?? []}
                onSelect={(item) => append({
                  descripcion: item.descripcion,
                  cantidad: 1,
                  precioUnitario: item.precioUnitario,
                  productoId: item.productoId,
                  materialId: item.materialId,
                })}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => append({ descripcion: '', cantidad: 1, precioUnitario: 0, productoId: null, materialId: null })}
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> Línea libre
              </Button>
            </div>
          </div>

          {errors.lineas?.root && <p className="text-xs text-red-500">{errors.lineas.root.message}</p>}
          {typeof errors.lineas?.message === 'string' && <p className="text-xs text-red-500">{errors.lineas.message}</p>}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descripción</TableHead>
                <TableHead className="w-24">Cantidad</TableHead>
                <TableHead className="w-32">P. Unitario</TableHead>
                <TableHead className="w-28 text-right">Subtotal</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                    Sin ítems — agregá del catálogo o una línea libre.
                  </TableCell>
                </TableRow>
              )}
              {lineas.map((field, idx) => {
                const cant = Number(watchLineas?.[idx]?.cantidad ?? 0);
                const precio = Number(watchLineas?.[idx]?.precioUnitario ?? 0);
                return (
                  <TableRow key={field.id}>
                    <TableCell>
                      <Input
                        className={`h-8 text-sm ${errors.lineas?.[idx]?.descripcion ? 'border-destructive' : ''}`}
                        {...register(`lineas.${idx}.descripcion`)}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number" step="any" min={0}
                        className="h-8 text-sm"
                        {...register(`lineas.${idx}.cantidad`, { valueAsNumber: true })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number" step="0.01" min={0}
                        className="h-8 text-sm"
                        {...register(`lineas.${idx}.precioUnitario`, { valueAsNumber: true })}
                      />
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      ${(cant * precio).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove(idx)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Notas */}
        <div className="space-y-1.5">
          <Label>Notas (opcional — condiciones de pago, plazo de entrega, etc.)</Label>
          <Textarea {...register('notas')} rows={3} />
        </div>

        {/* Totales + submit */}
        <div className="flex items-center justify-between border-t pt-4">
          <div className="text-sm space-y-0.5">
            <p>Subtotal sin IVA: <span className="tabular-nums font-medium">${subtotal.toFixed(2)}</span></p>
            <p>IVA (15%): <span className="tabular-nums font-medium">${iva.toFixed(2)}</span></p>
            <p className="text-base font-semibold">Total: <span className="tabular-nums">${total.toFixed(2)}</span></p>
          </div>
          <Button type="submit" disabled={crear.isPending}>
            {crear.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Guardar borrador
          </Button>
        </div>
      </form>
    </div>
  );
}
