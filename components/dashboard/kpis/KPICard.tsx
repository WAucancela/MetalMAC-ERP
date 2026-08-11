'use client';

import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface Props {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: 'default' | 'warning' | 'danger' | 'success';
  href?: string;
}

const VARIANT_STYLES = {
  default: 'bg-card border-border',
  warning: 'bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-900',
  danger:  'bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-900',
  success: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900',
};

const ICON_STYLES = {
  default: 'text-muted-foreground bg-muted',
  warning: 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/50',
  danger:  'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/50',
  success: 'text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/50',
};

export function KPICard({ title, value, subtitle, icon: Icon, variant = 'default', href }: Props) {
  const card = (
    <div className={cn(
      'rounded-lg border p-5 flex items-start gap-4 transition-shadow hover:shadow-sm',
      VARIANT_STYLES[variant],
    )}>
      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', ICON_STYLES[variant])}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-muted-foreground truncate">{title}</p>
        <p className="text-2xl font-bold mt-0.5 tabular-nums leading-none">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </div>
    </div>
  );

  if (href) {
    return (
      <a href={href} className="block">
        {card}
      </a>
    );
  }
  return card;
}
