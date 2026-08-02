/**
 * GET  /api/config/certificado-firma — estado del certificado de firma activo
 * POST /api/config/certificado-firma — sube/reemplaza el certificado activo
 *
 * Restringido a GERENTE únicamente (no BODEGUERO/PRODUCCION/CONTABILIDAD): es un
 * secreto sensible para todo el taller, no una operación de escritura de negocio
 * normal, así que no reutiliza `canWrite`.
 */

import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers';
import { SubirCertificadoSchema } from '@/lib/validations/certificado.schema';
import { subirCertificado, obtenerEstadoCertificado, CertificadoInvalidoError } from '@/lib/services/certificado.service';

// Nunca cachear: cada respuesta depende del usuario autenticado y de datos que cambian por request.
export const dynamic = 'force-dynamic';

function esGerente(rol: string): boolean {
  return rol === 'GERENTE';
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!esGerente(user.rol)) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  try {
    const estado = await obtenerEstadoCertificado();
    return NextResponse.json({ ok: true, data: estado });
  } catch (e) {
    console.error('[GET /api/config/certificado-firma]', e);
    return NextResponse.json({ error: 'Error al obtener el estado del certificado' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!esGerente(user.rol)) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Body inválido — se espera multipart/form-data' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'Campo "file" requerido con el certificado .p12' }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith('.p12')) {
    return NextResponse.json({ error: 'El archivo debe tener extensión .p12' }, { status: 400 });
  }
  if (file.size > 1024 * 1024) {
    return NextResponse.json({ error: 'El certificado no debe superar 1 MB' }, { status: 400 });
  }

  const parsed = SubirCertificadoSchema.safeParse({ password: formData.get('password') });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const resultado = await subirCertificado(fileBuffer, parsed.data.password, user.uid);
    return NextResponse.json({ ok: true, data: { vigenciaHasta: resultado.vigenciaHasta } });
  } catch (e) {
    if (e instanceof CertificadoInvalidoError) {
      // Mensaje claro de extraerCertificado (contraseña incorrecta / archivo corrupto).
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error('[POST /api/config/certificado-firma]', e);
    return NextResponse.json({ error: 'Error al subir el certificado' }, { status: 500 });
  }
}
