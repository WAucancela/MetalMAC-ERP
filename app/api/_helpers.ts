/**
 * Utilidades compartidas para todas las API Routes.
 * Importar en cada route para respuestas consistentes y autenticación.
 */
import { NextResponse } from 'next/server';
import type { ZodError } from 'zod';
import { adminAuth } from '@/lib/firebase-admin';

// ── Respuestas tipadas ────────────────────────────────────────────────────────

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function created<T>(data: T) {
  return ok(data, 201);
}

export function badRequest(message: string, issues?: unknown) {
  return NextResponse.json({ ok: false, message, issues }, { status: 400 });
}

export function unauthorized(message = 'No autorizado') {
  return NextResponse.json({ ok: false, message }, { status: 401 });
}

export function forbidden(message = 'Acceso denegado') {
  return NextResponse.json({ ok: false, message }, { status: 403 });
}

export function notFound(message = 'No encontrado') {
  return NextResponse.json({ ok: false, message }, { status: 404 });
}

export function conflict(message: string) {
  return NextResponse.json({ ok: false, message }, { status: 409 });
}

export function internalError(message = 'Error interno del servidor') {
  return NextResponse.json({ ok: false, message }, { status: 500 });
}

export function fromZodError(error: ZodError) {
  return badRequest('Datos de entrada inválidos', error.flatten().fieldErrors);
}

// ── Autenticación ─────────────────────────────────────────────────────────────

export interface AuthenticatedUser {
  uid: string;
  email: string | undefined;
  rol: string;
}

/**
 * Verifica el Bearer token de Firebase Auth en el header Authorization.
 * Retorna el usuario autenticado o null si el token es inválido/ausente.
 */
export async function getAuthenticatedUser(
  request: Request,
): Promise<AuthenticatedUser | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return {
      uid:   decoded.uid,
      email: decoded.email,
      rol:   (decoded.rol as string) ?? 'VIEWER',
    };
  } catch {
    return null;
  }
}

// ── Roles ─────────────────────────────────────────────────────────────────────

export const ROLES = {
  GERENTE:       'GERENTE',
  BODEGUERO:     'BODEGUERO',
  PRODUCCION:    'PRODUCCION',
  CONTABILIDAD:  'CONTABILIDAD',
} as const;

export function canWrite(user: AuthenticatedUser): boolean {
  return ['GERENTE', 'BODEGUERO'].includes(user.rol);
}
