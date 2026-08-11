/**
 * ExportButton — descarga un CSV desde una API Route de reportes.
 *
 * Props:
 *   href     — URL del endpoint (e.g. /api/reportes/inventario?format=csv)
 *   label    — texto del botón (default "Exportar CSV")
 *   filename — nombre sugerido del archivo descargado
 */
'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface ExportButtonProps {
  href:      string;
  label?:    string;
  filename?: string;
  className?: string;
}

export function ExportButton({
  href,
  label    = 'Exportar CSV',
  filename = 'export.csv',
  className = '',
}: ExportButtonProps) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (!token || loading) return;
    setLoading(true);

    try {
      const res = await fetch(href, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;

      // Preferir el filename del Content-Disposition si viene
      const cd = res.headers.get('Content-Disposition') ?? '';
      const match = cd.match(/filename="?([^";\n]+)"?/);
      a.download = match?.[1] ?? filename;

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[ExportButton]', err);
      alert(`Error al exportar: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading || !token}
      className={[
        'inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2',
        'text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50 transition-colors',
        className,
      ].join(' ')}
    >
      {loading
        ? <Loader2 className="h-4 w-4 animate-spin" />
        : <Download className="h-4 w-4" />
      }
      {loading ? 'Descargando…' : label}
    </button>
  );
}
