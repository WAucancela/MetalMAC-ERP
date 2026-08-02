/**
 * AntiguedadBadge — badge de color según el bucket de antigüedad de una
 * factura (calcularAntiguedad en lib/services/finanzas.service.ts).
 */

import { Badge } from '@/components/ui/badge';
import type { BucketAntiguedad } from '@/lib/services/finanzas.service';

const CONFIG: Record<BucketAntiguedad, { label: string; className: string }> = {
  SIN_VENCIMIENTO: { label: 'Sin vencimiento', className: 'bg-zinc-400 hover:bg-zinc-400' },
  VIGENTE:         { label: 'Vigente',          className: 'bg-emerald-600 hover:bg-emerald-600' },
  VENCIDO_0_30:    { label: 'Vencido 0-30 días',  className: 'bg-amber-500 hover:bg-amber-500' },
  VENCIDO_31_60:   { label: 'Vencido 31-60 días', className: 'bg-orange-500 hover:bg-orange-500' },
  VENCIDO_61_90:   { label: 'Vencido 61-90 días', className: 'bg-red-500 hover:bg-red-500' },
  VENCIDO_90_MAS:  { label: 'Vencido +90 días',   className: 'bg-red-700 hover:bg-red-700' },
};

export function AntiguedadBadge({ bucket }: { bucket: BucketAntiguedad }) {
  const { label, className } = CONFIG[bucket];
  return <Badge className={className}>{label}</Badge>;
}
