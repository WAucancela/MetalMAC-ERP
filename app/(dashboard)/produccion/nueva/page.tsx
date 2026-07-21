/**
 * /produccion/nueva — Formulario de nueva Orden de Producción
 */

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OrdenForm } from '@/components/produccion/OrdenForm';

export default function NuevaOrdenPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/produccion">
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">Nueva Orden de Producción</h1>
      </div>
      <OrdenForm />
    </div>
  );
}
