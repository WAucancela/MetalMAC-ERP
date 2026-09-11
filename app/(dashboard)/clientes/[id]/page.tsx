/**
 * /clientes/[id] — Vista 360° del cliente: datos + timeline de interacciones +
 * historial unificado (cotizaciones, proyectos, facturas de venta, pedidos
 * web) traído en un solo GET desde /api/clientes/[id].
 */
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ArrowLeft, Users, Phone, Mail, MapPin, MessageCircle, Edit2, Trash2,
  FileText, FolderOpen, Receipt, ShoppingCart, Plus, Loader2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import ClienteForm from '@/components/clientes/ClienteForm';
import { useCliente, useEliminarCliente, useCrearInteraccion } from '@/hooks/useClientes';
import { InteraccionSchema, type InteraccionInput } from '@/lib/validations/clientes.schema';

function formatDate(fecha: string | null | undefined): string {
  if (!fecha) return '—';
  try { return format(parseISO(fecha), 'dd MMM yyyy', { locale: es }); } catch { return fecha; }
}

function formatUSD(n: number): string {
  return `$${n.toLocaleString('es-EC', { minimumFractionDigits: 2 })}`;
}

const TIPO_INTERACCION_LABEL: Record<string, string> = {
  LLAMADA: 'Llamada', EMAIL: 'Email', REUNION: 'Reunión', NOTA: 'Nota',
};

type TabKey = 'cotizaciones' | 'proyectos' | 'facturas' | 'pedidos' | 'notas';

export default function ClienteDetallePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>('cotizaciones');
  const [editOpen, setEditOpen] = useState(false);
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false);

  const { data, isLoading } = useCliente(id);
  const eliminar = useEliminarCliente();
  const crearInteraccion = useCrearInteraccion(id);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<InteraccionInput>({
    resolver: zodResolver(InteraccionSchema),
    defaultValues: { tipo: 'NOTA', descripcion: '' },
  });

  const handleEliminar = async () => {
    try {
      await eliminar.mutateAsync(id);
      setConfirmandoEliminar(false);
      toast.success('Cliente desactivado');
      router.push('/clientes');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const onSubmitInteraccion = async (data: InteraccionInput) => {
    try {
      await crearInteraccion.mutateAsync(data);
      toast.success('Interacción registrada');
      reset({ tipo: 'NOTA', descripcion: '' });
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
        <Users className="h-10 w-10 text-muted-foreground" />
        <p className="text-muted-foreground">Cliente no encontrado</p>
        <Button variant="outline" onClick={() => router.push('/clientes')}>Volver a clientes</Button>
      </div>
    );
  }

  const { cliente, cotizaciones, proyectos, facturas, pedidosWeb, interacciones } = data;

  const TABS: Array<{ key: TabKey; label: string; icon: typeof FileText; count: number }> = [
    { key: 'cotizaciones', label: 'Cotizaciones', icon: FileText,     count: cotizaciones.length },
    { key: 'proyectos',    label: 'Proyectos',     icon: FolderOpen,  count: proyectos.length },
    { key: 'facturas',     label: 'Facturas',      icon: Receipt,     count: facturas.length },
    { key: 'pedidos',      label: 'Pedidos Web',   icon: ShoppingCart,count: pedidosWeb.length },
    { key: 'notas',        label: 'Notas',         icon: MessageCircle, count: interacciones.length },
  ];

  return (
    <div className="space-y-6 p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/clientes')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{cliente.razonSocial}</h1>
            {cliente.identificacion && (
              <p className="text-sm text-muted-foreground font-mono">
                {cliente.tipoIdentificacion ?? 'ID'}: {cliente.identificacion}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Edit2 className="mr-2 h-3.5 w-3.5" /> Editar
          </Button>
          <Button
            variant="ghost" size="sm" className="text-destructive hover:text-destructive"
            onClick={() => setConfirmandoEliminar(true)}
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" /> Desactivar
          </Button>
        </div>
      </div>

      {/* Info card */}
      <div className="rounded-lg border p-5 grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Mail className="h-4 w-4" /><span>{cliente.email || '—'}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Phone className="h-4 w-4" /><span>{cliente.telefono || cliente.whatsapp || '—'}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <MapPin className="h-4 w-4" /><span>{cliente.direccion || cliente.ciudad || '—'}</span>
        </div>
        {cliente.notas && (
          <div className="col-span-2 text-muted-foreground border-t pt-3 mt-1">{cliente.notas}</div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm border transition-colors ${
              tab === key
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background border-input hover:bg-muted'
            }`}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
            {count > 0 && <span className="text-xs opacity-75">({count})</span>}
          </button>
        ))}
      </div>

      {/* Contenido de tab */}
      <div className="rounded-lg border">
        {tab === 'cotizaciones' && (
          cotizaciones.length === 0 ? <EmptyRow texto="Sin cotizaciones registradas" /> : (
            <table className="w-full text-sm">
              <tbody className="divide-y">
                {cotizaciones.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => router.push(`/contabilidad/cotizaciones/${c.id}`)}>
                    <td className="px-4 py-3 font-mono text-xs">{c.numero}</td>
                    <td className="px-4 py-3"><Badge variant="outline">{c.estado}</Badge></td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(c.fechaEmision)}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatUSD(c.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}

        {tab === 'proyectos' && (
          proyectos.length === 0 ? <EmptyRow texto="Sin proyectos registrados" /> : (
            <table className="w-full text-sm">
              <tbody className="divide-y">
                {proyectos.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => router.push(`/proyectos/${p.id}`)}>
                    <td className="px-4 py-3 font-mono text-xs">{p.codigo}</td>
                    <td className="px-4 py-3">{p.nombre}</td>
                    <td className="px-4 py-3"><Badge variant="outline">{p.estado?.replace('_', ' ')}</Badge></td>
                    <td className="px-4 py-3 text-right font-medium">{formatUSD(p.costoReal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}

        {tab === 'facturas' && (
          facturas.length === 0 ? <EmptyRow texto="Sin facturas de venta registradas" /> : (
            <table className="w-full text-sm">
              <tbody className="divide-y">
                {facturas.map((f) => (
                  <tr key={f.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => router.push(`/contabilidad/facturas-venta/${f.id}`)}>
                    <td className="px-4 py-3 font-mono text-xs">{f.numeroFactura}</td>
                    <td className="px-4 py-3"><Badge variant="outline">{f.estado}</Badge></td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(f.fechaEmision)}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatUSD(f.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}

        {tab === 'pedidos' && (
          pedidosWeb.length === 0 ? <EmptyRow texto="Sin pedidos de tallermac.com" /> : (
            <table className="w-full text-sm">
              <tbody className="divide-y">
                {pedidosWeb.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => router.push(`/pedidos-woocommerce/${p.id}`)}>
                    <td className="px-4 py-3 font-mono text-xs">{p.numeroPedido}</td>
                    <td className="px-4 py-3"><Badge variant="outline">{p.estadoRevision}</Badge></td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(p.recibidoEn)}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatUSD(p.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}

        {tab === 'notas' && (
          <div className="p-4 space-y-4">
            <form onSubmit={handleSubmit(onSubmitInteraccion)} className="flex gap-2 items-start">
              <Select value={watch('tipo')} onValueChange={(v) => setValue('tipo', v as InteraccionInput['tipo'])}>
                <SelectTrigger className="w-36 shrink-0"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NOTA">Nota</SelectItem>
                  <SelectItem value="LLAMADA">Llamada</SelectItem>
                  <SelectItem value="EMAIL">Email</SelectItem>
                  <SelectItem value="REUNION">Reunión</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex-1 space-y-1">
                <Textarea
                  {...register('descripcion')}
                  rows={2}
                  placeholder="¿Qué pasó? — ej. 'Llamó preguntando por el estado de COT-2026-0012'"
                />
                {errors.descripcion && <p className="text-xs text-destructive">{errors.descripcion.message}</p>}
              </div>
              <Button type="submit" size="icon" disabled={crearInteraccion.isPending}>
                {crearInteraccion.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </form>

            {interacciones.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Sin interacciones registradas todavía.</p>
            ) : (
              <div className="space-y-3 border-t pt-4">
                {interacciones.map((i) => (
                  <div key={i.id} className="flex gap-3 text-sm">
                    <Badge variant="secondary" className="shrink-0 h-fit">{TIPO_INTERACCION_LABEL[i.tipo] ?? i.tipo}</Badge>
                    <div className="flex-1">
                      <p>{i.descripcion}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatDate(i.creadoEn)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sheet editar */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>Editar cliente</SheetTitle></SheetHeader>
          <div className="mt-6">
            <ClienteForm cliente={cliente} onSuccess={() => setEditOpen(false)} onCancel={() => setEditOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirmandoEliminar}
        onOpenChange={setConfirmandoEliminar}
        title="¿Desactivar este cliente?"
        confirmLabel="Desactivar"
        variant="destructive"
        loading={eliminar.isPending}
        onConfirm={handleEliminar}
      />
    </div>
  );
}

function EmptyRow({ texto }: { texto: string }) {
  return <p className="text-sm text-muted-foreground py-10 text-center">{texto}</p>;
}
