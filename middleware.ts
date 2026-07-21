/**
 * middleware.ts — Protección de rutas /(dashboard)/*
 *
 * Verifica la cookie de sesión de Firebase Auth. Si no hay sesión,
 * redirige a /login. Las rutas públicas (/login, /api/*) pasan sin verificación.
 *
 * Estrategia Edge-compatible:
 * - El token JWT de Firebase se almacena en una cookie `__session` (nombre
 *   reservado para Cloud Run / Firebase Hosting).
 * - La verificación criptográfica completa ocurre en las API Routes (Admin SDK).
 * - En Edge sólo verificamos presencia del token para una redirección rápida;
 *   el Admin SDK verifica la firma en cada API call de todas formas.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/** Rutas que no requieren autenticación */
const PUBLIC_PATHS = ['/login', '/api/', '/_next/', '/favicon.ico'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Dejar pasar rutas públicas
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Verificar presencia del token (cookie __session o header Authorization)
  const sessionCookie = request.cookies.get('__session')?.value;
  const authHeader = request.headers.get('Authorization');
  const hasToken = !!sessionCookie || !!authHeader;

  if (!hasToken) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  /*
   * Aplicar middleware a todas las rutas excepto:
   * - archivos estáticos (_next/static, _next/image, favicon)
   * - archivos con extensión (.png, .svg, .ico, etc.)
   */
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
