/**
 * Dashboard — página principal del ERP MetalMAC
 *
 * KPIs en tiempo real de los 4 módulos:
 * - Inventario (stock bajo mínimo)
 * - Producción (OPs activas, vencidas, completadas hoy)
 * - Contabilidad (facturas pendientes, monto)
 * - Proyectos (activos, riesgo presupuestal)
 *
 * Se actualiza automáticamente cada 2 minutos.
 */

'use client';

import Link from 'next/link';
import {
  Package, Factory, FileText, FolderOpen,
  AlertTriangle, CheckCircle2, Clock, RefreshCw,
  TrendingUp, Loader2, Landmark, ArrowDownToLine, ArrowUpFromLine,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { KPICard } from '@/components/dashboard/kpis/KPICard';
import { ResumenPresupuesto } from '@/components/proyectos/ResumenPresupuesto';
import { useDashboardKPIs } from '@/hooks/useDashboard';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

function LoadingGrid() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-24 w-full" />
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { data: kpis, isLoading, error, dataUpdatedAt, isFetching } = useDashboardKPIs();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
        <LoadingGrid />
      </div>
    );
  }

  if (error || !kpis?.data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-red-500 mb-2" />
        <p className="text-sm text-red-700">No se pudo cargar el dashboard. Verifica tu conexión.</p>
      </div>
    );
  }

  const { inventario, produccion, contabilidad, proyectos, cuentasPorCobrar, cuentasPorPagar, tesoreria } = kpis.data;
  const actualizadoEn = dataUpdatedAt ? new Date(dataUpdatedAt) : null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          {actualizadoEn && (
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              {isFetching && <RefreshCw className="h-3 w-3 animate-spin" />}
              Actualizado {format(actualizadoEn, "HH:mm 'del' dd MMM", { locale: es })}
            </p>
          )}
        </div>
      </div>

      {/* ── KPI Grid principal ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          title="Materiales bajo stock"
          value={inventario.materialesBajoStock}
          subtitle="requieren reposición"
          icon={Package}
          variant={inventario.materialesBajoStock > 0 ? 'warning' : 'success'}
          href="/inventario"
        />
        <KPICard
          title="OPs en proceso"
          value={produccion.opsEnProceso}
          subtitle={`${produccion.opsBorrador} en borrador`}
          icon={Factory}
          variant={produccion.opsVencidas > 0 ? 'danger' : 'default'}
          href="/produccion"
        />
        <KPICard
          title="Facturas pendientes"
          value={contabilidad.facturasPendientes}
          subtitle={`$${contabilidad.montoPendiente.toFixed(2)} por pagar`}
          icon={FileText}
          variant={contabilidad.facturasPendientes > 5 ? 'warning' : 'default'}
          href="/contabilidad/facturas-compra"
        />
        <KPICard
          title="Proyectos activos"
          value={proyectos.proyectosActivos}
          subtitle={proyectos.proyectosEnRiesgo > 0
            ? `${proyectos.proyectosEnRiesgo} en riesgo presupuestal`
            : 'Sin riesgo presupuestal'}
          icon={FolderOpen}
          variant={proyectos.proyectosEnRiesgo > 0 ? 'warning' : 'success'}
          href="/proyectos"
        />
      </div>

      {/* ── Segunda fila KPIs ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          title="OPs completadas hoy"
          value={produccion.opsCompletadasHoy}
          icon={CheckCircle2}
          variant="success"
          href="/produccion"
        />
        <KPICard
          title="OPs vencidas"
          value={produccion.opsVencidas}
          subtitle="fecha entrega superada"
          icon={Clock}
          variant={produccion.opsVencidas > 0 ? 'danger' : 'success'}
          href="/produccion"
        />
        <KPICard
          title="Presupuesto activos"
          value={`$${(proyectos.presupuestoTotalActivos / 1000).toFixed(1)}k`}
          subtitle={`$${(proyectos.ejecutadoTotalActivos / 1000).toFixed(1)}k ejecutado`}
          icon={TrendingUp}
          variant="default"
          href="/proyectos"
        />
        <KPICard
          title="Monto por pagar"
          value={`$${(contabilidad.montoPendiente / 1000).toFixed(1)}k`}
          subtitle={`${contabilidad.facturasPendientes} facturas`}
          icon={FileText}
          variant={contabilidad.montoPendiente > 10000 ? 'warning' : 'default'}
          href="/contabilidad/facturas-compra"
        />
      </div>

      {/* ── Tercera fila KPIs — tesorería ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          title="Saldo caja + bancos"
          value={`$${(tesoreria.saldoCajaChica + tesoreria.saldoBancos).toFixed(2)}`}
          subtitle={`$${tesoreria.saldoBancos.toFixed(2)} en bancos`}
          icon={Landmark}
          variant="default"
          href="/contabilidad/bancos"
        />
        <KPICard
          title="Por cobrar"
          value={`$${(cuentasPorCobrar.totalPendiente / 1000).toFixed(1)}k`}
          subtitle={`$${cuentasPorCobrar.vencido.toFixed(2)} vencido`}
          icon={ArrowDownToLine}
          variant={cuentasPorCobrar.vencido > 0 ? 'warning' : 'success'}
          href="/contabilidad/cuentas-por-cobrar"
        />
        <KPICard
          title="Por pagar"
          value={`$${(cuentasPorPagar.totalPendiente / 1000).toFixed(1)}k`}
          subtitle={`$${cuentasPorPagar.vencido.toFixed(2)} vencido`}
          icon={ArrowUpFromLine}
          variant={cuentasPorPagar.vencido > 0 ? 'danger' : 'success'}
          href="/contabilidad/cuentas-por-pagar"
        />
        <KPICard
          title="Caja chica"
          value={`$${tesoreria.saldoCajaChica.toFixed(2)}`}
          icon={Landmark}
          variant="default"
          href="/contabilidad/caja-chica"
        />
      </div>

      {/* ── Secciones de detalle ───────────────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-6">

        {/* Proyectos en riesgo */}
        <div className="rounded-lg border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Proyectos — presupuesto</h2>
            <Link href="/proyectos" className="text-xs text-primary hover:underline">Ver todos</Link>
          </div>
          {proyectos.proyectosActivos === 0 ? (
            <p className="text-sm text-muted-foreground">No hay proyectos activos.</p>
          ) : (
            <div className="space-y-4">
              {proyectos.detalleRiesgo.slice(0, 4).map((p) => (
                <div key={p.id} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Link href={`/proyectos/${p.id}`} className="text-sm font-medium hover:underline truncate max-w-[200px]">
                      {p.nombre}
                    </Link>
                    <Badge variant="destructive" className="text-[10px]">Riesgo</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{p.cliente}</p>
                  <ResumenPresupuesto
                    presupuesto={p.presupuesto}
                    costoReal={p.costoReal}
                  />
                </div>
              ))}
              {proyectos.detalleRiesgo.length === 0 && (
                <div className="flex items-center gap-2 text-sm text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" />
                  Todos los proyectos dentro del presupuesto
                </div>
              )}
            </div>
          )}
        </div>

        {/* Facturas pendientes */}
        <div className="rounded-lg border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Facturas pendientes de pago</h2>
            <Link href="/contabilidad/facturas-compra" className="text-xs text-primary hover:underline">Ver todas</Link>
          </div>
          {contabilidad.facturasPendientes === 0 ? (
            <div className="flex items-center gap-2 text-sm text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              Sin facturas pendientes
            </div>
          ) : (
            <div className="space-y-3">
              {contabilidad.facturasUltimas5.map((f) => (
                <div key={f.id} className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{f.razonSocialProveedor ?? '—'}</p>
                    <p className="text-xs text-muted-foreground font-mono">{f.numeroFactura}</p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums ml-3 shrink-0">
                    ${f.total.toFixed(2)}
                  </span>
                </div>
              ))}
              {contabilidad.facturasPendientes > 5 && (
                <p className="text-xs text-muted-foreground">
                  + {contabilidad.facturasPendientes - 5} más
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Tesorería: cuentas vencidas + saldo por banco ─────────────────────── */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="rounded-lg border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Por cobrar vencido</h2>
            <Link href="/contabilidad/cuentas-por-cobrar" className="text-xs text-primary hover:underline">Ver todo</Link>
          </div>
          {cuentasPorCobrar.facturasVencidas.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-emerald-600">
              <CheckCircle2 className="h-4 w-4" /> Sin vencidas
            </div>
          ) : (
            <div className="space-y-2">
              {cuentasPorCobrar.facturasVencidas.map((f) => (
                <div key={f.id} className="flex items-center justify-between text-sm">
                  <span className="truncate max-w-[140px]">{f.clienteNombre}</span>
                  <span className="font-semibold tabular-nums">${f.saldo.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Por pagar vencido</h2>
            <Link href="/contabilidad/cuentas-por-pagar" className="text-xs text-primary hover:underline">Ver todo</Link>
          </div>
          {cuentasPorPagar.facturasVencidas.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-emerald-600">
              <CheckCircle2 className="h-4 w-4" /> Sin vencidas
            </div>
          ) : (
            <div className="space-y-2">
              {cuentasPorPagar.facturasVencidas.map((f) => (
                <div key={f.id} className="flex items-center justify-between text-sm">
                  <span className="truncate max-w-[140px]">{f.proveedorNombre ?? '—'}</span>
                  <span className="font-semibold tabular-nums">${f.saldo.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Bancos</h2>
            <Link href="/contabilidad/bancos" className="text-xs text-primary hover:underline">Ver todo</Link>
          </div>
          {tesoreria.cuentas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin cuentas bancarias registradas.</p>
          ) : (
            <div className="space-y-2">
              {tesoreria.cuentas.map((c) => (
                <div key={`${c.banco}-${c.numeroCuenta}`} className="flex items-center justify-between text-sm">
                  <span className="truncate max-w-[140px]">{c.banco}</span>
                  <span className="font-semibold tabular-nums">${c.saldo.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Alertas de stock */}
      {inventario.materialesBajoStock > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <h2 className="text-sm font-semibold text-amber-800">
              {inventario.materialesBajoStock} material{inventario.materialesBajoStock !== 1 ? 'es' : ''} bajo stock mínimo
            </h2>
            <Link href="/inventario" className="ml-auto text-xs text-amber-700 hover:underline font-medium">
              Ver inventario →
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {inventario.materialIdsAlerta.map((mid) => (
              <Link
                key={mid}
                href={`/inventario/${mid}`}
                className="text-xs font-mono bg-amber-100 hover:bg-amber-200 text-amber-800 px-2 py-0.5 rounded transition-colors"
              >
                {mid}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
