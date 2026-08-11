'use client';

import { cn } from '@/lib/utils';

interface Props {
  presupuesto: number;
  costoReal: number;
  costoEstimado?: number;
  className?: string;
}

export function ResumenPresupuesto({ presupuesto, costoReal, costoEstimado, className }: Props) {
  const pct = presupuesto > 0 ? Math.min((costoReal / presupuesto) * 100, 100) : 0;
  const sobrePasado = costoReal > presupuesto;
  const disponible  = Math.max(0, presupuesto - costoReal);

  return (
    <div className={cn('space-y-2', className)}>
      {/* Barra */}
      <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            sobrePasado ? 'bg-red-500' : pct > 80 ? 'bg-amber-500' : 'bg-emerald-500',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Números */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-[10px] text-muted-foreground">Presupuesto</p>
          <p className="text-sm font-semibold tabular-nums">${presupuesto.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">Ejecutado</p>
          <p className={cn('text-sm font-semibold tabular-nums', sobrePasado && 'text-red-600')}>
            ${costoReal.toFixed(2)}
            {sobrePasado && <span className="ml-1 text-[10px]">⚠️</span>}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">Disponible</p>
          <p className={cn('text-sm font-semibold tabular-nums', sobrePasado ? 'text-red-600' : 'text-emerald-600')}>
            {sobrePasado ? `-$${(costoReal - presupuesto).toFixed(2)}` : `$${disponible.toFixed(2)}`}
          </p>
        </div>
      </div>

      {/* Porcentaje */}
      <p className="text-center text-xs text-muted-foreground">
        {pct.toFixed(1)}% ejecutado
        {costoEstimado !== undefined && costoEstimado > 0 && (
          <> · Estimado: <span className="tabular-nums">${costoEstimado.toFixed(2)}</span></>
        )}
      </p>
    </div>
  );
}
