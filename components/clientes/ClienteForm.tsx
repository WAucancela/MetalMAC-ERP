/**
 * ClienteForm.tsx — Formulario de creación/edición de cliente.
 * Incluye autocompletado opcional de razón social por RUC (ver limitaciones
 * en app/api/clientes/consultar-identificacion/route.ts) — nunca bloquea el
 * guardado si la consulta falla.
 */
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ClienteSchema, type ClienteInput } from '@/lib/validations/clientes.schema';
import { useCrearCliente, useActualizarCliente, useConsultarIdentificacion } from '@/hooks/useClientes';
import type { Cliente } from '@/types/metalmac.types';

interface ClienteFormProps {
  cliente?: Cliente;
  onSuccess?: (id: string) => void;
  onCancel?: () => void;
}

export default function ClienteForm({ cliente, onSuccess, onCancel }: ClienteFormProps) {
  const isEditing = !!cliente;
  const crear = useCrearCliente();
  const actualizar = useActualizarCliente();
  const consultarSRI = useConsultarIdentificacion();
  const [buscando, setBuscando] = useState(false);

  const {
    register, handleSubmit, setValue, watch, formState: { errors, isSubmitting },
  } = useForm<ClienteInput>({
    resolver: zodResolver(ClienteSchema),
    defaultValues: cliente
      ? {
          tipoIdentificacion: cliente.tipoIdentificacion,
          identificacion: cliente.identificacion,
          razonSocial: cliente.razonSocial,
          nombreComercial: cliente.nombreComercial,
          email: cliente.email,
          telefono: cliente.telefono,
          whatsapp: cliente.whatsapp,
          direccion: cliente.direccion,
          ciudad: cliente.ciudad,
          notas: cliente.notas,
          activo: cliente.activo,
        }
      : {
          tipoIdentificacion: 'RUC',
          identificacion: '',
          activo: true,
        },
  });

  const tipoIdentificacion = watch('tipoIdentificacion');
  const identificacion = watch('identificacion');

  const handleBuscarRUC = async () => {
    if (!identificacion || identificacion.length !== 13) {
      toast.error('Ingresá un RUC de 13 dígitos');
      return;
    }
    setBuscando(true);
    try {
      const resultado = await consultarSRI.mutateAsync(identificacion);
      if (resultado.found && resultado.razonSocial) {
        setValue('razonSocial', resultado.razonSocial);
        toast.success('Razón social completada desde el SRI');
      } else {
        toast.info('No se encontró el RUC en el SRI — completá los datos manualmente');
      }
    } catch {
      toast.info('No se pudo consultar el SRI ahora — completá los datos manualmente');
    } finally {
      setBuscando(false);
    }
  };

  const onSubmit = async (data: ClienteInput) => {
    try {
      if (isEditing && cliente) {
        await actualizar.mutateAsync({ id: cliente.id, data });
        toast.success('Cliente actualizado');
        onSuccess?.(cliente.id);
      } else {
        const { id } = await crear.mutateAsync(data);
        toast.success('Cliente creado correctamente');
        onSuccess?.(id);
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
        <div className="space-y-1.5">
          <Label htmlFor="identificacion">RUC / Cédula</Label>
          <Input
            id="identificacion"
            {...register('identificacion')}
            placeholder="0900000000001"
            maxLength={20}
          />
          {errors.identificacion && <p className="text-xs text-destructive">{errors.identificacion.message}</p>}
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={handleBuscarRUC}
          disabled={buscando || tipoIdentificacion !== 'RUC' || (identificacion?.length ?? 0) !== 13}
          title="Autocompletar razón social desde el SRI (RUC de 13 dígitos)"
        >
          {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label>Tipo de identificación</Label>
        <Select
          value={tipoIdentificacion ?? undefined}
          onValueChange={(v) => setValue('tipoIdentificacion', v as ClienteInput['tipoIdentificacion'])}
        >
          <SelectTrigger>
            <SelectValue placeholder="Sin especificar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="RUC">RUC</SelectItem>
            <SelectItem value="CEDULA">Cédula</SelectItem>
            <SelectItem value="PASAPORTE">Pasaporte</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="razonSocial">Razón social / Nombre *</Label>
        <Input id="razonSocial" {...register('razonSocial')} placeholder="Constructora XYZ S.A." />
        {errors.razonSocial && <p className="text-xs text-destructive">{errors.razonSocial.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="nombreComercial">Nombre comercial</Label>
        <Input id="nombreComercial" {...register('nombreComercial')} placeholder="Opcional" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" {...register('email')} placeholder="cliente@empresa.com" />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="telefono">Teléfono</Label>
          <Input id="telefono" {...register('telefono')} placeholder="0999000000" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="whatsapp">WhatsApp</Label>
          <Input id="whatsapp" {...register('whatsapp')} placeholder="+593 99 999 9999" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ciudad">Ciudad</Label>
          <Input id="ciudad" {...register('ciudad')} placeholder="Guayaquil" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="direccion">Dirección</Label>
        <Input id="direccion" {...register('direccion')} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notas">Notas internas</Label>
        <Textarea id="notas" {...register('notas')} rows={3} placeholder="Preferencias, condiciones acordadas, etc." />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando…' : isEditing ? 'Actualizar' : 'Crear cliente'}
        </Button>
      </div>
    </form>
  );
}
