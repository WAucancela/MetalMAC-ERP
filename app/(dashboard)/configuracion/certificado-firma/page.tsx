/**
 * /configuracion/certificado-firma — subir/reemplazar el certificado .p12 de
 * firma electrónica (restringido a GERENTE). Reemplaza a las env vars
 * SRI_FIRMA_P12_BASE64/SRI_FIRMA_P12_PASSWORD: el certificado activo vive en
 * Supabase Storage y la ruta /emitir lo lee de ahí en cada emisión.
 */

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { format, differenceInCalendarDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

import { SubirCertificadoSchema, type SubirCertificadoInput } from '@/lib/validations/certificado.schema';
import { useAuth } from '@/hooks/useAuth';
import { useCertificadoFirma, useSubirCertificadoFirma } from '@/hooks/useCertificadoFirma';

function EstadoBadge({ vigenciaHasta }: { vigenciaHasta: string | null }) {
  if (!vigenciaHasta) {
    return <Badge variant="destructive">Sin certificado cargado</Badge>;
  }
  const dias = differenceInCalendarDays(new Date(vigenciaHasta), new Date());
  const fecha = format(new Date(vigenciaHasta), 'dd MMM yyyy', { locale: es });

  if (dias < 0) return <Badge variant="destructive">Venció el {fecha}</Badge>;
  if (dias <= 30) return <Badge className="bg-amber-500 hover:bg-amber-500">Vence el {fecha} — en {dias} días</Badge>;
  return <Badge className="bg-emerald-600 hover:bg-emerald-600">Vence el {fecha}</Badge>;
}

export default function CertificadoFirmaPage() {
  const { rol, loading: authLoading } = useAuth();
  const { data: estado, isLoading } = useCertificadoFirma();
  const subir = useSubirCertificadoFirma();
  const [file, setFile] = useState<File | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<SubirCertificadoInput>({
    resolver: zodResolver(SubirCertificadoSchema),
  });

  const onSubmit = async (data: SubirCertificadoInput) => {
    if (!file) {
      toast.error('Seleccioná el archivo .p12');
      return;
    }
    if (!confirm('¿Reemplazar el certificado de firma activo? Todas las emisiones futuras usarán este nuevo certificado.')) {
      return;
    }
    try {
      const resultado = await subir.mutateAsync({ file, password: data.password });
      toast.success(`Certificado cargado — vence el ${format(new Date(resultado.vigenciaHasta), 'dd MMM yyyy', { locale: es })}`);
      reset();
      setFile(null);
    } catch (e: any) {
      toast.error(e.message ?? 'Error al subir el certificado');
    }
  };

  if (authLoading) return <Skeleton className="h-40 w-full max-w-lg" />;

  if (rol !== 'GERENTE') {
    return <p className="text-sm text-muted-foreground">No tenés permiso para ver esta página.</p>;
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-semibold">Certificado de firma</h1>
        <p className="text-sm text-muted-foreground">
          Certificado .p12 usado para firmar electrónicamente las facturas de venta ante el SRI.
        </p>
      </div>

      <div className="rounded-lg border p-4 space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Estado actual</p>
        {isLoading ? <Skeleton className="h-6 w-48" /> : <EstadoBadge vigenciaHasta={estado?.vigenciaHasta ?? null} />}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-md border p-4">
        <p className="text-sm font-medium">Subir / reemplazar certificado</p>

        <div className="space-y-1.5">
          <Label htmlFor="file">Archivo .p12</Label>
          <Input
            id="file"
            type="file"
            accept=".p12"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Contraseña del certificado</Label>
          <Input id="password" type="password" {...register('password')} />
          {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
        </div>

        <Button type="submit" disabled={subir.isPending}>
          {subir.isPending
            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Subiendo…</>
            : 'Subir certificado'}
        </Button>
      </form>
    </div>
  );
}
