/**
 * FacturaUploader.tsx
 *
 * Componente de drag-and-drop para subir un XML de factura SRI.
 * Flujo:
 *   1. Usuario arrastra/selecciona el .xml
 *   2. Se llama a /api/sri/parse-xml → muestra preview de la factura parseada
 *   3. Se llama a /api/sri/resolver-equivalencias → muestra líneas con materialId o sin resolver
 *   4. Usuario confirma → se crea la factura en Firestore
 */

'use client';

import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { UploadCloud, FileX, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  useParsearXML,
  useResolverEquivalencias,
  useCrearFactura,
} from '@/hooks/useFacturas';
import type { FacturaXMLParseada, LineaResuelta } from '@/types/metalmac.types';

interface FacturaUploaderProps {
  proveedorId: string;
  onSuccess?: (facturaId: string) => void;
  onCancel?: () => void;
}

type Step = 'idle' | 'parsing' | 'preview' | 'resolving' | 'confirmar' | 'creating';

export default function FacturaUploader({
  proveedorId,
  onSuccess,
  onCancel,
}: FacturaUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [step, setStep] = useState<Step>('idle');
  const [factura, setFactura] = useState<FacturaXMLParseada | null>(null);
  const [lineas, setLineas] = useState<LineaResuelta[]>([]);
  const [resolucionPct, setResolucionPct] = useState(0);

  const parsearXML = useParsearXML();
  const resolverEq = useResolverEquivalencias();
  const crearFactura = useCrearFactura();

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.endsWith('.xml')) {
        toast.error('Solo se aceptan archivos .xml');
        return;
      }

      setStep('parsing');
      try {
        const parsed = await parsearXML.mutateAsync(file);
        setFactura(parsed);
        setStep('preview');

        // Auto-resolver equivalencias
        setStep('resolving');
        const res = await resolverEq.mutateAsync({ proveedorId, lineas: parsed.lineas });
        setLineas(res.lineas);
        setResolucionPct(res.porcentajeResolucion);
        setStep('confirmar');
      } catch (e) {
        toast.error((e as Error).message);
        setStep('idle');
      }
    },
    [proveedorId, parsearXML, resolverEq],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleConfirmar = async () => {
    if (!factura) return;
    setStep('creating');
    try {
      const body = {
        proveedorId,
        claveAcceso: factura.claveAcceso,
        numeroFactura: factura.numeroFactura,
        fechaEmision: factura.fechaEmision.includes('/')
          ? factura.fechaEmision.split('/').reverse().join('-')
          : factura.fechaEmision,
        subtotalSinIva: factura.subtotalSinIva,
        iva: factura.totalIva,
        total: factura.importeTotal,
        xmlUrl: '',
        estado: 'PENDIENTE',
        lineas: lineas.map((l) => ({
          codigoProveedor: l.codigoInterno,
          descripcion: l.descripcion,
          cantidad: l.cantidad,
          precioUnitario: l.precioUnitario,
          descuento: l.descuento,
          subtotal: l.precioTotalSinImpuesto,
          materialId: l.materialId,
          cantidadConvertida: l.cantidadConvertida,
        })),
        retenciones: [],
      };

      const { id } = await crearFactura.mutateAsync(body);
      toast.success('Factura registrada correctamente');
      onSuccess?.(id);
    } catch (e) {
      toast.error((e as Error).message);
      setStep('confirmar');
    }
  };

  if (step === 'idle') {
    return (
      <div
        className={cn(
          'relative flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-12 transition-colors',
          isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50',
        )}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <UploadCloud className="h-10 w-10 text-muted-foreground" />
        <div className="text-center">
          <p className="font-medium">Arrastra el XML de la factura aquí</p>
          <p className="text-sm text-muted-foreground">o haz click para seleccionar</p>
        </div>
        <Button variant="outline" onClick={() => inputRef.current?.click()}>
          Seleccionar archivo
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".xml"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
      </div>
    );
  }

  if (step === 'parsing' || step === 'resolving') {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">
          {step === 'parsing' ? 'Parseando XML…' : 'Resolviendo equivalencias…'}
        </p>
      </div>
    );
  }

  if (step === 'confirmar' && factura) {
    const sinResolver = lineas.filter((l) => !l.resuelta).length;

    return (
      <div className="space-y-4">
        {/* Cabecera de la factura */}
        <div className="rounded-lg border p-4 space-y-1">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-sm">Factura {factura.numeroFactura}</p>
            <Badge variant="outline">{factura.claveAcceso.slice(0, 10)}…</Badge>
          </div>
          <p className="text-xs text-muted-foreground">{factura.razonSocialEmisor} — {factura.rucEmisor}</p>
          <p className="text-xs">Fecha: {factura.fechaEmision}</p>
          <div className="flex gap-4 pt-1 text-sm">
            <span>Subtotal: <strong>${factura.subtotalSinIva.toFixed(2)}</strong></span>
            <span>IVA: <strong>${factura.totalIva.toFixed(2)}</strong></span>
            <span>Total: <strong>${factura.importeTotal.toFixed(2)}</strong></span>
          </div>
        </div>

        {/* Resolución */}
        <div className={cn(
          'flex items-center gap-2 rounded-md px-3 py-2 text-sm',
          sinResolver === 0 ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700',
        )}>
          {sinResolver === 0
            ? <CheckCircle2 className="h-4 w-4" />
            : <AlertTriangle className="h-4 w-4" />}
          {sinResolver === 0
            ? `Todas las líneas resueltas (${resolucionPct}%)`
            : `${sinResolver} línea(s) sin resolver — se guardarán sin materialId`}
        </div>

        {/* Tabla de líneas */}
        <div className="overflow-x-auto rounded-md border text-xs">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Descripción</th>
                <th className="px-3 py-2 text-right font-medium">Cantidad</th>
                <th className="px-3 py-2 text-right font-medium">P. Unit</th>
                <th className="px-3 py-2 text-right font-medium">Subtotal</th>
                <th className="px-3 py-2 text-left font-medium">Material</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {lineas.map((l, i) => (
                <tr key={i} className={l.resuelta ? '' : 'bg-amber-50/40'}>
                  <td className="px-3 py-2 max-w-[200px] truncate">{l.descripcion}</td>
                  <td className="px-3 py-2 text-right">{l.cantidad}</td>
                  <td className="px-3 py-2 text-right">${l.precioUnitario.toFixed(4)}</td>
                  <td className="px-3 py-2 text-right">${l.precioTotalSinImpuesto.toFixed(2)}</td>
                  <td className="px-3 py-2">
                    {l.resuelta
                      ? <Badge variant="secondary" className="text-xs">{l.materialId?.slice(0, 8)}…</Badge>
                      : <Badge variant="outline" className="text-xs text-amber-600">Sin resolver</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => { setStep('idle'); setFactura(null); onCancel?.(); }}>
            Cancelar
          </Button>
          <Button onClick={handleConfirmar}>
            Registrar factura
          </Button>
        </div>
      </div>
    );
  }

  if (step === 'creating') {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Guardando factura…</p>
      </div>
    );
  }

  return null;
}
