/**
 * EstadoOrdenBadge — Badge de color por estado de OP
 */

import { Badge } from '@/components/ui/badge';
import type { OrdenResumen } from '@/hooks/useOrdenes';

const CONFIG: Record<
  OrdenResumen['estado'],
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  BORRADOR:   { label: 'Borrador',    variant: 'secondary' },
  EN_PROCESO: { label: 'En Proceso',  variant: 'default' },
  COMPLETADA: { label: 'Completada',  variant: 'outline' },
  CANCELADA:  { label: 'Cancelada',   variant: 'destructive' },
};

interface Props {
  estado: OrdenResumen['estado'];
}

export function EstadoOrdenBadge({ estado }: Props) {
  const { label, variant } = CONFIG[estado] ?? { label: estado, variant: 'secondary' };
  return <Badge variant={variant}>{label}</Badge>;
}
