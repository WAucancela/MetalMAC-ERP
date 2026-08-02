/**
 * POST /api/sri/parse-xml
 *
 * Acepta un XML de factura SRI (multipart/form-data, campo "file").
 * También acepta el XML como texto plano en body si Content-Type: text/xml.
 *
 * Responde con la estructura normalizada FacturaXMLParseada.
 * NO guarda nada en Firestore — solo parsea y valida.
 */

import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers';

// Nunca cachear: cada respuesta depende del usuario autenticado y de datos que cambian por request.
export const dynamic = 'force-dynamic';
import {
  parsearXML,
  XMLInvalidoError,
  ClaveAccesoInvalidaError,
} from '@/lib/services/sri.service';

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    let xmlString: string;

    const contentType = request.headers.get('content-type') ?? '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file');

      if (!file || !(file instanceof File)) {
        return NextResponse.json(
          { error: 'Campo "file" requerido con el XML de la factura' },
          { status: 400 },
        );
      }

      if (file.size > 2 * 1024 * 1024) {
        return NextResponse.json(
          { error: 'El XML no debe superar 2 MB' },
          { status: 400 },
        );
      }

      xmlString = await file.text();
    } else {
      // Texto plano (útil para pruebas con curl/Postman)
      xmlString = await request.text();
    }

    if (!xmlString.trim()) {
      return NextResponse.json(
        { error: 'El cuerpo del XML está vacío' },
        { status: 400 },
      );
    }

    const resultado = parsearXML(xmlString);

    return NextResponse.json({ ok: true, data: resultado });
  } catch (e) {
    if (e instanceof XMLInvalidoError) {
      return NextResponse.json({ error: e.message }, { status: 422 });
    }
    if (e instanceof ClaveAccesoInvalidaError) {
      return NextResponse.json({ error: e.message }, { status: 422 });
    }
    console.error('[/api/sri/parse-xml] Error inesperado:', e);
    return NextResponse.json({ error: 'Error interno al parsear el XML' }, { status: 500 });
  }
}
