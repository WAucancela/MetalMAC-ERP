'use client';

import { cn } from '@/lib/utils';

interface Props {
  disponible: number;
  minima:     number;
  className?: string;
}

export function StockBadge({ disponible, minima, className }: Props) {
  const pct = minima > 0 ? (disponible / minima) * 100 : 100;
  const color =
    disponible === 0          ? 'bg-red-100 text-red-700 ring-red-200'
    : pct < 100               ? 'bg-amber-100 text-amber-700 ring-amber-200'
    :                           'bg-emerald-100 text-emerald-700 ring-emerald-200';

  const label =
    disponible === 0 ? 'Sin stock'
    : pct < 100      ? 'Bajo mínimo'
    :                  'OK';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        color,
        className,
      )}
    >
      <span className="font-mono">{disponible.toLocaleString('es-EC', { maximumFractionDigits: 2 })}</span>
      <span className="opacity-60">· {label}</span>
    </span>
  );
}
