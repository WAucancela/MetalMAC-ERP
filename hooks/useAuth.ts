/**
 * useAuth — expone usuario, token y rol de Supabase Auth.
 *
 * La sesión se persiste en cookies automáticamente vía @supabase/ssr (sin el
 * hack manual de `document.cookie` que tenía la versión Firebase) — el
 * middleware las lee directamente con su propio cliente server-side.
 */
'use client';

import { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

interface AuthState {
  user:    User | null;
  token:   string | null;
  rol:     string | null;
  loading: boolean;
}

export function useAuth(): AuthState & { signOut: () => Promise<void> } {
  const [state, setState] = useState<AuthState>({
    user: null, token: null, rol: null, loading: true,
  });

  useEffect(() => {
    const supabase = createClient();

    const applySession = (session: { user: User; access_token: string } | null) => {
      if (session) {
        // Sin fallback a un rol inventado: sin claim `rol` en app_metadata, el
        // usuario queda sin rol de negocio (los checks de permiso lo tratan
        // como no autorizado, igual que en app/api/_helpers.ts).
        const rol = (session.user.app_metadata?.rol as string | undefined) ?? null;
        setState({ user: session.user, token: session.access_token, rol, loading: false });
      } else {
        setState({ user: null, token: null, rol: null, loading: false });
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => applySession(session));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setState({ user: null, token: null, rol: null, loading: false });
  };

  return { ...state, signOut };
}
