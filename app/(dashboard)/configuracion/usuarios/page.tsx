/**
 * /configuracion/usuarios — administración de cuentas y roles (solo GERENTE).
 *
 * Alta de usuarios: el GERENTE define (o genera) una contraseña temporal y se
 * la entrega al empleado en persona/WhatsApp — no hay invitación por email
 * (requeriría tener Resend/SMTP configurado, ver Configuración → SRI/Email).
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, Copy, Loader2, RefreshCw } from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';
import { useUsuarios, useCrearUsuario, useActualizarUsuario, type Usuario } from '@/hooks/useUsuarios';
import { ROLES_USUARIO } from '@/lib/validations/usuarios.schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const ROL_LABELS: Record<string, string> = {
  GERENTE: 'Gerente',
  BODEGUERO: 'Bodeguero',
  PRODUCCION: 'Producción',
  CONTABILIDAD: 'Contabilidad',
};

function generarPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function FilaUsuario({ usuario, esYoMismo }: { usuario: Usuario; esYoMismo: boolean }) {
  const actualizar = useActualizarUsuario(usuario.id);

  async function cambiarRol(rol: string) {
    try {
      await actualizar.mutateAsync({ rol: rol as Usuario['rol'] });
      toast.success('Rol actualizado');
    } catch (e: any) {
      toast.error(e.message ?? 'Error al actualizar el rol');
    }
  }

  async function alternarActivo() {
    try {
      await actualizar.mutateAsync({ activo: !usuario.activo });
      toast.success(usuario.activo ? 'Usuario desactivado' : 'Usuario activado');
    } catch (e: any) {
      toast.error(e.message ?? 'Error al actualizar el usuario');
    }
  }

  return (
    <TableRow>
      <TableCell className="text-sm">
        {usuario.email}
        {esYoMismo && <span className="ml-2 text-xs text-muted-foreground">(vos)</span>}
      </TableCell>
      <TableCell>
        <Select value={usuario.rol} onValueChange={cambiarRol} disabled={actualizar.isPending || (esYoMismo)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLES_USUARIO.map((r) => (
              <SelectItem key={r} value={r}>{ROL_LABELS[r]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Badge variant={usuario.activo ? 'secondary' : 'outline'} className={usuario.activo ? '' : 'text-muted-foreground'}>
          {usuario.activo ? 'Activo' : 'Inactivo'}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <Button
          size="sm"
          variant="outline"
          className={usuario.activo ? 'text-destructive' : ''}
          disabled={actualizar.isPending || esYoMismo}
          onClick={alternarActivo}
        >
          {actualizar.isPending
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : usuario.activo ? 'Desactivar' : 'Activar'}
        </Button>
      </TableCell>
    </TableRow>
  );
}

export default function UsuariosPage() {
  const { rol, loading: authLoading, user } = useAuth();
  const { data: usuarios = [], isLoading } = useUsuarios();
  const crear = useCrearUsuario();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(generarPassword());
  const [rolNuevo, setRolNuevo] = useState<string>('BODEGUERO');
  const [creado, setCreado] = useState<{ email: string; password: string } | null>(null);

  if (authLoading) return <Skeleton className="h-40 w-full max-w-2xl" />;
  if (rol !== 'GERENTE') {
    return <p className="text-sm text-muted-foreground">No tenés permiso para ver esta página.</p>;
  }

  async function onCrear(e: React.FormEvent) {
    e.preventDefault();
    if (!email || password.length < 8) {
      toast.error('Completá un email y una contraseña de al menos 8 caracteres');
      return;
    }
    try {
      await crear.mutateAsync({ email, password, rol: rolNuevo as any });
      setCreado({ email, password });
      setEmail('');
      setPassword(generarPassword());
      setRolNuevo('BODEGUERO');
    } catch (e: any) {
      toast.error(e.message ?? 'Error al crear el usuario');
    }
  }

  function copiar(texto: string) {
    navigator.clipboard.writeText(texto);
    toast.success('Copiado');
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/configuracion"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">Usuarios</h1>
          <p className="text-sm text-muted-foreground">Cuentas del taller y sus roles — solo visible para GERENTE.</p>
        </div>
      </div>

      {creado && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 space-y-2 text-sm dark:border-amber-900 dark:bg-amber-950/40">
          <p className="font-medium text-amber-900 dark:text-amber-200">
            Usuario creado — copiá esta contraseña ahora, no se va a volver a mostrar.
          </p>
          <div className="flex items-center gap-2">
            <code className="rounded bg-background px-2 py-1 border">{creado.email}</code>
            <code className="rounded bg-background px-2 py-1 border font-mono">{creado.password}</code>
            <Button size="sm" variant="outline" onClick={() => copiar(`${creado.email} / ${creado.password}`)}>
              <Copy className="mr-1.5 h-3.5 w-3.5" /> Copiar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCreado(null)}>Cerrar</Button>
          </div>
        </div>
      )}

      {/* Alta de usuario */}
      <form onSubmit={onCrear} className="rounded-lg border p-6 space-y-4">
        <h2 className="text-sm font-semibold">Nuevo usuario</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" placeholder="empleado@metalmac.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Rol</Label>
            <Select value={rolNuevo} onValueChange={setRolNuevo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES_USUARIO.map((r) => (
                  <SelectItem key={r} value={r}>{ROL_LABELS[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Contraseña temporal</Label>
          <div className="flex gap-2">
            <Input value={password} onChange={(e) => setPassword(e.target.value)} className="font-mono" />
            <Button type="button" variant="outline" size="icon" onClick={() => setPassword(generarPassword())} title="Generar otra">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Se genera automáticamente — se la pasás vos mismo al empleado (WhatsApp, en persona). Puede cambiarla después.
          </p>
        </div>
        <Button type="submit" size="sm" disabled={crear.isPending}>
          {crear.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creando…</> : 'Crear usuario'}
        </Button>
      </form>

      {/* Listado */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Cuentas existentes</h2>
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : usuarios.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay usuarios registrados.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead className="w-44">Rol</TableHead>
                <TableHead className="w-24">Estado</TableHead>
                <TableHead className="w-28 text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuarios.map((u) => (
                <FilaUsuario key={u.id} usuario={u} esYoMismo={u.id === user?.id} />
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
