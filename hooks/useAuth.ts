/**
 * useAuth — expone usuario, token y rol de Firebase Auth.
 *
 * Al recibir un nuevo token lo persiste en la cookie __session para que
 * el middleware de Next.js pueda detectar la sesión sin Admin SDK (Edge).
 *
 * La cookie tiene SameSite=Strict y no es accesible desde JS (httpOnly=false
 * por limitación del cliente — la verificación real de firma ocurre en el
 * Admin SDK dentro de cada API Route).
 */
'use client';

import { useState, useEffect } from 'react';
import { onIdTokenChanged, signOut as firebaseSignOut, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';

interface AuthState {
  user:    User | null;
  token:   string | null;
  rol:     string;
  loading: boolean;
}

const SESSION_COOKIE = '__session';

function setSessionCookie(token: string | null) {
  if (typeof document === 'undefined') return;
  if (token) {
    // Expira en 1 hora (Firebase renueva antes)
    const expires = new Date(Date.now() + 60 * 60 * 1000).toUTCString();
    document.cookie = `${SESSION_COOKIE}=${token}; path=/; expires=${expires}; SameSite=Strict`;
  } else {
    // Borrar cookie
    document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; SameSite=Strict`;
  }
}

export function useAuth(): AuthState & { signOut: () => Promise<void> } {
  const [state, setState] = useState<AuthState>({
    user: null, token: null, rol: 'OPERARIO', loading: true,
  });

  useEffect(() => {
    const unsub = onIdTokenChanged(auth, async (user) => {
      if (user) {
        const token = await user.getIdToken();
        // Leer rol de los custom claims (si no existe, default OPERARIO)
        const claims = (await user.getIdTokenResult()).claims;
        const rol = (claims.rol as string) ?? 'OPERARIO';

        setSessionCookie(token);
        setState({ user, token, rol, loading: false });
      } else {
        setSessionCookie(null);
        setState({ user: null, token: null, rol: 'OPERARIO', loading: false });
      }
    });
    return unsub;
  }, []);

  const signOut = async () => {
    setSessionCookie(null);
    await firebaseSignOut(auth);
  };

  return { ...state, signOut };
}
