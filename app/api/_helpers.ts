/**
 * Utilidades compartidas para todas las API Routes.
 * Importar en cada route para respuestas consistentes y autenticación.
 */
import { NextResponse } from 'next/server';
import type { ZodError } from 'zod';
import { jwtVerify, createRemoteJWKSet } from 'jose';

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

// Los proyectos Supabase nuevos (incluida cualquier instancia local del CLI) firman los
// JWT con claves asimétricas (ES256) publicadas en el endpoint JWKS del proyecto — no con
// el secreto HS256 compartido "legacy" (SUPABASE_JWT_SECRET) que usan los proyectos viejos.
// `createRemoteJWKSet` cachea las claves en memoria tras la primera verificación, así que
// el costo de red sólo se paga una vez por arranque (no por request) — igual perfil de
// latencia que `adminAuth.verifyIdToken` en la versión Firebase.
const JWKS = createRemoteJWKSet(
  new URL('/auth/v1/.well-known/jwks.json', process.env.NEXT_PUBLIC_SUPABASE_URL!),
);

/**
 * Verifica el Bearer token de Supabase Auth en el header Authorization.
 * Retorna el usuario autenticado o null si el token es inválido/ausente, o si
 * no trae un claim `rol` válido en `app_metadata` (sin fallback a un rol falso).
 */
export async function getAuthenticatedUser(
  request: Request,
): Promise<AuthenticatedUser | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  try {
    const { payload } = await jwtVerify(token, JWKS);
    const appMetadata = payload.app_metadata as Record<string, unknown> | undefined;
    const rol = appMetadata?.rol as string | undefined;
    if (!rol) return null;

    return {
      uid:   payload.sub!,
      email: payload.email as string | undefined,
      rol,
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

// ── Paginación por cursor (columna_orden, id) ──────────────────────────────────
//
// Reemplaza el `startAfter(docSnapshot)` de Firestore, que no tiene equivalente
// directo en Postgres/PostgREST. El cursor codifica el punto (valor, id) de la
// última fila de la página anterior; la siguiente página pide filas
// estrictamente "antes"/"después" en ese orden — usando `id` como desempate
// porque la columna de orden sola no es única (fecha, fecha_entrega, etc.).
// Reutilizado por las rutas con listados paginados por una columna de fecha
// (movimientos, órdenes de producción, gastos, facturas).

export interface Cursor {
  valor: string;
  id: string;
}

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

export function decodeCursor(raw: string): Cursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (typeof parsed?.valor === 'string' && typeof parsed?.id === 'string') return parsed;
    return null;
  } catch {
    return null;
  }
}

/** Filtro PostgREST para "(campo, id) < (cursor.valor, cursor.id)" — para orden campo desc, id desc. */
export function cursorFilterAntesDe(campo: string, cursor: Cursor): string {
  return `${campo}.lt.${cursor.valor},and(${campo}.eq.${cursor.valor},id.lt.${cursor.id})`;
}

/** Filtro PostgREST para "(campo, id) > (cursor.valor, cursor.id)" — para orden campo asc, id asc. */
export function cursorFilterDespuesDe(campo: string, cursor: Cursor): string {
  return `${campo}.gt.${cursor.valor},and(${campo}.eq.${cursor.valor},id.gt.${cursor.id})`;
}
