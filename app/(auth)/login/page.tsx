/**
 * /login — Autenticación con Supabase Auth (email/password).
 * Redirige a /inventario tras login exitoso.
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  const router = useRouter();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(
        signInError.message.includes('Invalid login credentials')
          ? 'Correo o contraseña incorrectos.'
          : 'Error al iniciar sesión. Intenta de nuevo.',
      );
      setLoading(false);
      return;
    }

    router.push('/inventario');
    router.refresh();
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6 overflow-hidden rounded-xl border border-border bg-card p-8 shadow-sm">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="rounded-lg bg-white p-2 shadow-sm">
            <Image src="/logo.png" alt="MetalMAC" width={1088} height={960} className="h-16 w-auto" priority />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold text-foreground">MetalMAC ERP</h1>
            <p className="text-sm text-muted-foreground">Ingresa con tu cuenta corporativa</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="usuario@metalmac.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground/70">
          ¿Olvidaste tu contraseña? Contacta al administrador.
        </p>
      </div>
    </div>
  );
}
