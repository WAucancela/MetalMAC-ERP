/**
 * ProveedorForm.tsx — Formulario de creación/edición de proveedor
 * Usa React Hook Form + Zod + shadcn/ui
 */

'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ProveedorSchema, type ProveedorInput } from '@/lib/validations/sri.schema';
import { useCrearProveedor, useActualizarProveedor } from '@/hooks/useProveedores';
import type { Proveedor } from '@/types/metalmac.types';

interface ProveedorFormProps {
  proveedor?: Proveedor;           // Si viene, modo edición
  onSuccess?: (id: string) => void;
  onCancel?: () => void;
}

export default function ProveedorForm({ proveedor, onSuccess, onCancel }: ProveedorFormProps) {
  const isEditing = !!proveedor;
  const crear = useCrearProveedor();
  const actualizar = useActualizarProveedor();

  const form = useForm<ProveedorInput>({
    resolver: zodResolver(ProveedorSchema),
    defaultValues: proveedor
      ? {
          ruc: proveedor.ruc,
          razonSocial: proveedor.razonSocial,
          nombreComercial: proveedor.nombreComercial,
          tipoContribuyente: proveedor.tipoContribuyente,
          contribuyenteEspecial: proveedor.contribuyenteEspecial,
          obligaContabilidad: proveedor.obligaContabilidad,
          agenteRetencion: proveedor.agenteRetencion,
          diasCredito: proveedor.diasCredito,
          telefonoPrincipal: proveedor.telefonoPrincipal,
          emailPrincipal: proveedor.emailPrincipal,
          ciudad: proveedor.ciudad,
          activo: proveedor.activo,
        }
      : {
          tipoContribuyente: 'SOCIEDAD',
          contribuyenteEspecial: false,
          obligaContabilidad: false,
          agenteRetencion: false,
          diasCredito: 30,
          activo: true,
        },
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = form;

  const onSubmit = async (data: ProveedorInput) => {
    try {
      if (isEditing && proveedor) {
        await actualizar.mutateAsync({ id: proveedor.id, data });
        toast.success('Proveedor actualizado');
        onSuccess?.(proveedor.id);
      } else {
        const { id } = await crear.mutateAsync(data as Omit<Proveedor, 'id'>);
        toast.success('Proveedor creado correctamente');
        onSuccess?.(id);
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* RUC */}
      <div className="space-y-1.5">
        <Label htmlFor="ruc">RUC *</Label>
        <Input
          id="ruc"
          {...register('ruc')}
          placeholder="0900000000001"
          maxLength={13}
          disabled={isEditing} // No se puede cambiar el RUC
        />
        {errors.ruc && <p className="text-xs text-destructive">{errors.ruc.message}</p>}
      </div>

      {/* Razón social */}
      <div className="space-y-1.5">
        <Label htmlFor="razonSocial">Razón social *</Label>
        <Input id="razonSocial" {...register('razonSocial')} placeholder="EMPRESA S.A." />
        {errors.razonSocial && <p className="text-xs text-destructive">{errors.razonSocial.message}</p>}
      </div>

      {/* Nombre comercial */}
      <div className="space-y-1.5">
        <Label htmlFor="nombreComercial">Nombre comercial *</Label>
        <Input id="nombreComercial" {...register('nombreComercial')} placeholder="Empresa" />
        {errors.nombreComercial && <p className="text-xs text-destructive">{errors.nombreComercial.message}</p>}
      </div>

      {/* Tipo contribuyente */}
      <div className="space-y-1.5">
        <Label>Tipo contribuyente *</Label>
        <Select
          value={watch('tipoContribuyente')}
          onValueChange={(v) => setValue('tipoContribuyente', v as ProveedorInput['tipoContribuyente'])}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="SOCIEDAD">Sociedad</SelectItem>
            <SelectItem value="PERSONA_NATURAL">Persona Natural</SelectItem>
            <SelectItem value="RISE">RISE</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Checkboxes */}
      <div className="grid grid-cols-3 gap-4">
        {(
          [
            ['contribuyenteEspecial', 'Contrib. especial'],
            ['obligaContabilidad', 'Obliga contabilidad'],
            ['agenteRetencion', 'Agente retención'],
          ] as const
        ).map(([field, label]) => (
          <label key={field} className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              {...register(field)}
              className="h-4 w-4 rounded border-gray-300"
            />
            {label}
          </label>
        ))}
      </div>

      {/* Días crédito, teléfono, email, ciudad */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="diasCredito">Días crédito</Label>
          <Input
            id="diasCredito"
            type="number"
            {...register('diasCredito', { valueAsNumber: true })}
            min={0}
            max={365}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ciudad">Ciudad *</Label>
          <Input id="ciudad" {...register('ciudad')} placeholder="Guayaquil" />
          {errors.ciudad && <p className="text-xs text-destructive">{errors.ciudad.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="telefonoPrincipal">Teléfono *</Label>
          <Input id="telefonoPrincipal" {...register('telefonoPrincipal')} placeholder="0999000000" />
          {errors.telefonoPrincipal && <p className="text-xs text-destructive">{errors.telefonoPrincipal.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="emailPrincipal">Email *</Label>
          <Input id="emailPrincipal" type="email" {...register('emailPrincipal')} placeholder="contacto@empresa.com" />
          {errors.emailPrincipal && <p className="text-xs text-destructive">{errors.emailPrincipal.message}</p>}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando…' : isEditing ? 'Actualizar' : 'Crear proveedor'}
        </Button>
      </div>
    </form>
  );
}
