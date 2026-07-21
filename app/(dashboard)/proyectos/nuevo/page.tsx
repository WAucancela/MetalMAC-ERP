import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProyectoForm } from '@/components/proyectos/ProyectoForm';

export default function NuevoProyectoPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/proyectos"><ChevronLeft className="h-4 w-4" /></Link>
        </Button>
        <h1 className="text-2xl font-semibold">Nuevo Proyecto</h1>
      </div>
      <ProyectoForm />
    </div>
  );
}
