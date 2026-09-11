/**
 * /reportes — pantalla que junta los 6 endpoints de exportación que ya
 * existían en el backend (app/api/reportes/*) pero nunca tuvieron una
 * pantalla que los mostrara. Cada reporte se descarga como CSV vía
 * ExportButton (ya existente) — esta página solo arma los filtros de cada
 * uno y arma la URL con los query params que cada endpoint espera.
 */
'use client';

import { useState } from 'react';
import { addDays, format, subDays } from 'date-fns';
import { FileSpreadsheet } from 'lucide-react';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExportButton } from '@/components/ui/ExportButton';
import { useCentrosCosto } from '@/hooks/useCentrosCosto';

const SIN_FILTRO = '__todos__';

function hoyISO(): string {
  return format(new Date(), 'yyyy-MM-dd');
}
function hace30DiasISO(): string {
  return format(subDays(new Date(), 30), 'yyyy-MM-dd');
}
function en30DiasISO(): string {
  return format(addDays(new Date(), 30), 'yyyy-MM-dd');
}

function ReporteCard({
  titulo,
  descripcion,
  children,
  exportHref,
  filename,
}: {
  titulo: string;
  descripcion: string;
  children?: React.ReactNode;
  exportHref: string;
  filename: string;
}) {
  return (
    <div className="rounded-lg border p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-muted p-2">
          <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">{titulo}</h3>
          <p className="text-xs text-muted-foreground">{descripcion}</p>
        </div>
      </div>
      {children && <div className="flex flex-wrap items-end gap-3">{children}</div>}
      <ExportButton href={exportHref} filename={filename} label="Descargar CSV" />
    </div>
  );
}

export default function ReportesPage() {
  // Cuentas por Cobrar / Pagar: sin filtros de fecha (son "a hoy").
  // Caja + Bancos, Gastos, Producción: requieren rango de fechas.
  const [caCDesde, setCajaBancosDesde] = useState(hace30DiasISO());
  const [caCHasta, setCajaBancosHasta] = useState(hoyISO());

  const [gastosDesde, setGastosDesde] = useState(hace30DiasISO());
  const [gastosHasta, setGastosHasta] = useState(hoyISO());
  const [centroCostoId, setCentroCostoId] = useState('');
  const { data: centros } = useCentrosCosto({ activo: true });

  const [invTipo, setInvTipo] = useState('');

  const [prodDesde, setProdDesde] = useState(hace30DiasISO());
  const [prodHasta, setProdHasta] = useState(en30DiasISO());
  const [prodEstado, setProdEstado] = useState('');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reportes</h1>
        <p className="text-sm text-muted-foreground">
          Exportá los datos del ERP a CSV para Excel, tu contador, o lo que necesites.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ReporteCard
          titulo="Cuentas por Cobrar"
          descripcion="Facturas de venta emitidas con saldo pendiente, con antigüedad de vencimiento."
          exportHref="/api/reportes/cuentas-por-cobrar?format=csv"
          filename="cuentas_por_cobrar.csv"
        />

        <ReporteCard
          titulo="Cuentas por Pagar"
          descripcion="Facturas de compra (no anuladas) con saldo pendiente, con antigüedad de vencimiento."
          exportHref="/api/reportes/cuentas-por-pagar?format=csv"
          filename="cuentas_por_pagar.csv"
        />

        <ReporteCard
          titulo="Caja Chica + Bancos"
          descripcion="Movimientos de caja chica y de todas las cuentas bancarias en el rango de fechas."
          exportHref={`/api/reportes/caja-bancos?format=csv&desde=${caCDesde}&hasta=${caCHasta}`}
          filename={`caja_bancos_${caCDesde}_${caCHasta}.csv`}
        >
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Desde</Label>
            <Input type="date" className="w-40" value={caCDesde} onChange={(e) => setCajaBancosDesde(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Hasta</Label>
            <Input type="date" className="w-40" value={caCHasta} onChange={(e) => setCajaBancosHasta(e.target.value)} />
          </div>
        </ReporteCard>

        <ReporteCard
          titulo="Gastos"
          descripcion="Gastos generales y de proyecto en el rango de fechas, con centro de costo opcional."
          exportHref={
            `/api/reportes/gastos?format=csv&desde=${gastosDesde}&hasta=${gastosHasta}` +
            (centroCostoId ? `&centroCostoId=${centroCostoId}` : '')
          }
          filename={`gastos_${gastosDesde}_${gastosHasta}.csv`}
        >
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Desde</Label>
            <Input type="date" className="w-40" value={gastosDesde} onChange={(e) => setGastosDesde(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Hasta</Label>
            <Input type="date" className="w-40" value={gastosHasta} onChange={(e) => setGastosHasta(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Centro de costo</Label>
            <Select value={centroCostoId || SIN_FILTRO} onValueChange={(v) => setCentroCostoId(v === SIN_FILTRO ? '' : v)}>
              <SelectTrigger className="w-52"><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={SIN_FILTRO}>Todos</SelectItem>
                {(centros ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.codigo} — {c.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </ReporteCard>

        <ReporteCard
          titulo="Inventario"
          descripcion="Stock actual (disponible, reservado, mínimo) de todos los materiales activos."
          exportHref={`/api/reportes/inventario?format=csv` + (invTipo ? `&tipo=${invTipo}` : '')}
          filename="inventario.csv"
        >
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Tipo de material</Label>
            <Select value={invTipo || SIN_FILTRO} onValueChange={(v) => setInvTipo(v === SIN_FILTRO ? '' : v)}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={SIN_FILTRO}>Todos</SelectItem>
                <SelectItem value="PLANCHA">Plancha</SelectItem>
                <SelectItem value="TUBO">Tubo</SelectItem>
                <SelectItem value="PERFIL">Perfil</SelectItem>
                <SelectItem value="VARILLA">Varilla</SelectItem>
                <SelectItem value="CONSUMIBLE">Consumible</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </ReporteCard>

        <ReporteCard
          titulo="Producción"
          descripcion="Órdenes de producción creadas en el rango de fechas, con su costo estimado y real."
          exportHref={
            `/api/reportes/produccion?format=csv&desde=${prodDesde}&hasta=${prodHasta}` +
            (prodEstado ? `&estado=${prodEstado}` : '')
          }
          filename={`produccion_${prodDesde}_${prodHasta}.csv`}
        >
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Desde</Label>
            <Input type="date" className="w-40" value={prodDesde} onChange={(e) => setProdDesde(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Hasta</Label>
            <Input type="date" className="w-40" value={prodHasta} onChange={(e) => setProdHasta(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Estado</Label>
            <Select value={prodEstado || SIN_FILTRO} onValueChange={(v) => setProdEstado(v === SIN_FILTRO ? '' : v)}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={SIN_FILTRO}>Todos</SelectItem>
                <SelectItem value="BORRADOR">Borrador</SelectItem>
                <SelectItem value="EN_PROCESO">En proceso</SelectItem>
                <SelectItem value="COMPLETADA">Completada</SelectItem>
                <SelectItem value="CANCELADA">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </ReporteCard>
      </div>
    </div>
  );
}
