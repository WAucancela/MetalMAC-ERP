/**
 * /configuracion/sri — ambiente del SRI, datos del emisor y configuración de
 * envío de email (Resend). Restringido a GERENTE. Reemplaza a las env vars
 * SRI_AMBIENTE, SRI_EMISOR_..., RESEND_API_KEY y RESEND_FROM_EMAIL.
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ChevronLeft, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { ConfiguracionSRISchema, type ConfiguracionSRIInput } from '@/lib/validations/configuracion-sri.schema';
import { useAuth } from '@/hooks/useAuth';
import { useConfiguracionSRI, useGuardarConfiguracionSRI } from '@/hooks/useConfiguracionSRI';

export default function ConfiguracionSRIPage() {
  const { rol, loading: authLoading } = useAuth();
  const { data: estado, isLoading } = useConfiguracionSRI();
  const guardar = useGuardarConfiguracionSRI();

  const { register, handleSubmit, control, reset, watch, formState: { errors } } = useForm<ConfiguracionSRIInput>({
    resolver: zodResolver(ConfiguracionSRISchema),
  });

  useEffect(() => {
    if (!estado) return;
    reset({
      ambiente: estado.ambiente ?? undefined,
      emisorRuc: estado.emisorRuc ?? '',
      emisorRazonSocial: estado.emisorRazonSocial ?? '',
      emisorNombreComercial: estado.emisorNombreComercial ?? '',
      emisorDirMatriz: estado.emisorDirMatriz ?? '',
      emisorDirEstablecimiento: estado.emisorDirEstablecimiento ?? '',
      emisorObligadoContabilidad: estado.emisorObligadoContabilidad ?? undefined,
      resendFromEmail: estado.resendFromEmail ?? '',
      resendApiKey: '',
    });
  }, [estado, reset]);

  const ambienteElegido = watch('ambiente');

  const onSubmit = async (data: ConfiguracionSRIInput) => {
    if (data.ambiente === 'PRODUCCION') {
      if (!confirm('¿Confirmás que querés usar el ambiente de PRODUCCIÓN del SRI? Las próximas emisiones enviarán comprobantes reales, no de prueba.')) {
        return;
      }
    }
    try {
      await guardar.mutateAsync(data);
      toast.success('Configuración guardada');
    } catch (e: any) {
      toast.error(e.message ?? 'Error al guardar la configuración');
    }
  };

  if (authLoading) return <Skeleton className="h-40 w-full max-w-lg" />;

  if (rol !== 'GERENTE') {
    return <p className="text-sm text-muted-foreground">No tenés permiso para ver esta página.</p>;
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/configuracion"><ChevronLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">SRI / Email</h1>
          <p className="text-sm text-muted-foreground">Ambiente del SRI, datos del emisor y envío de email.</p>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-md border p-4">
          <div className="space-y-1.5">
            <Label htmlFor="ambiente">Ambiente del SRI</Label>
            <Controller
              name="ambiente"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="ambiente">
                    <SelectValue placeholder="Seleccionar ambiente..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRUEBAS">Pruebas</SelectItem>
                    <SelectItem value="PRODUCCION">Producción</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            {errors.ambiente && <p className="text-xs text-red-500">{errors.ambiente.message}</p>}
            {ambienteElegido === 'PRODUCCION' && (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
                ⚠️ En PRODUCCIÓN las emisiones envían comprobantes reales al SRI.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="emisorRuc">RUC del emisor</Label>
            <Input id="emisorRuc" className="font-mono" {...register('emisorRuc')} />
            {errors.emisorRuc && <p className="text-xs text-red-500">{errors.emisorRuc.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="emisorRazonSocial">Razón social</Label>
            <Input id="emisorRazonSocial" {...register('emisorRazonSocial')} />
            {errors.emisorRazonSocial && <p className="text-xs text-red-500">{errors.emisorRazonSocial.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="emisorNombreComercial">Nombre comercial</Label>
            <Input id="emisorNombreComercial" {...register('emisorNombreComercial')} />
            {errors.emisorNombreComercial && <p className="text-xs text-red-500">{errors.emisorNombreComercial.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="emisorDirMatriz">Dirección de la matriz</Label>
            <Input id="emisorDirMatriz" {...register('emisorDirMatriz')} />
            {errors.emisorDirMatriz && <p className="text-xs text-red-500">{errors.emisorDirMatriz.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="emisorDirEstablecimiento">Dirección del establecimiento</Label>
            <Input id="emisorDirEstablecimiento" {...register('emisorDirEstablecimiento')} />
            {errors.emisorDirEstablecimiento && <p className="text-xs text-red-500">{errors.emisorDirEstablecimiento.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="emisorObligadoContabilidad">¿Obligado a llevar contabilidad?</Label>
            <Controller
              name="emisorObligadoContabilidad"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="emisorObligadoContabilidad">
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SI">Sí</SelectItem>
                    <SelectItem value="NO">No</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            {errors.emisorObligadoContabilidad && <p className="text-xs text-red-500">{errors.emisorObligadoContabilidad.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="resendFromEmail">Email remitente (Resend)</Label>
            <Input id="resendFromEmail" type="email" placeholder="facturacion@tudominio.com" {...register('resendFromEmail')} />
            {errors.resendFromEmail && <p className="text-xs text-red-500">{errors.resendFromEmail.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="resendApiKey">API key de Resend</Label>
            <Input
              id="resendApiKey"
              type="password"
              placeholder={estado?.resendApiKeyConfigurada ? 'Dejar en blanco para mantener la actual' : 're_...'}
              {...register('resendApiKey')}
            />
          </div>

          <Button type="submit" disabled={guardar.isPending}>
            {guardar.isPending
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando…</>
              : 'Guardar configuración'}
          </Button>
        </form>
      )}
    </div>
  );
}
