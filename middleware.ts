/**
 * middleware.ts — Protección de rutas /(dashboard)/*
 *
 * Verifica la sesión de Supabase Auth (cookies gestionadas por @supabase/ssr).
 * Si no hay sesión válida, redirige a /login. Las rutas públicas (/login,
 * /api/*) pasan sin verificación.
 *
 * A diferencia de la versión Firebase (que sólo verificaba presencia de un
 * token, dejando la firma real para el Admin SDK en cada API Route),
 * `auth.getUser()` aquí SÍ hace una verificación criptográfica real contra
 * Supabase Auth — un chequeo más caro, pero que sólo corre en navegación de
 * página, no en cada llamada a la API (esas siguen usando el Bearer token +
 * verificación local con `jose` en app/api/_helpers.ts).
 */

import { NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { NextRequest } from 'next/server';

/** Rutas que no requieren autenticación */
const PUBLIC_PATHS = ['/login', '/api/', '/_next/', '/favicon.ico'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Dejar pasar rutas públicas
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  /*
   * Aplicar middleware a todas las rutas excepto:
   * - archivos estáticos (_next/static, _next/image, favicon)
   * - archivos con extensión (.png, .svg, .ico, etc.)
   */
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
