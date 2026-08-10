/**
 * /configuracion — índice de pantallas de configuración (restringido a GERENTE).
 */

'use client';

import Link from 'next/link';
import { ShieldCheck, Mail, Users } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';

const SECCIONES = [
  {
    href: '/configuracion/usuarios',
    icon: Users,
    titulo: 'Usuarios',
    descripcion: 'Cuentas del taller: crear usuarios, asignar roles, activar/desactivar accesos.',
  },
  {
    href: '/configuracion/certificado-firma',
    icon: ShieldCheck,
    titulo: 'Certificado de firma',
    descripcion: 'Certificado .p12 usado para firmar electrónicamente las facturas de venta.',
  },
  {
    href: '/configuracion/sri',
    icon: Mail,
    titulo: 'SRI / Email',
    descripcion: 'Ambiente del SRI, datos del emisor y configuración de envío de email.',
  },
];

export default function ConfiguracionPage() {
  const { rol, loading } = useAuth();

  if (loading) return <Skeleton className="h-40 w-full max-w-lg" />;

  if (rol !== 'GERENTE') {
    return <p className="text-sm text-muted-foreground">No tenés permiso para ver esta página.</p>;
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-semibold">Configuración</h1>
        <p className="text-sm text-muted-foreground">Ajustes sensibles del sistema, solo visibles para GERENTE.</p>
      </div>

      <div className="grid gap-3">
        {SECCIONES.map(({ href, icon: Icon, titulo, descripcion }) => (
          <Link
            key={href}
            href={href}
            className="flex items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50"
          >
            <Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{titulo}</p>
              <p className="text-xs text-muted-foreground">{descripcion}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
