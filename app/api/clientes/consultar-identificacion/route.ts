/**
 * GET /api/clientes/consultar-identificacion?ruc=1790012893001
 *
 * Autocompletado OPCIONAL de razón social a partir del RUC, usando el mismo
 * backend REST que usa el buscador público de "SRI en línea"
 * (srienlinea.sri.gob.ec) — es el mecanismo que usan de facto muchos sistemas
 * de facturación en Ecuador para esto, pero es importante ser claros sobre
 * qué tan sólido es:
 *
 *   ⚠️ NO es un servicio oficial documentado por el SRI (a diferencia de los
 *   WSDL de recepción/autorización que sí usamos en sri-soap.service.ts). No
 *   tiene API key, SLA, ni garantía de que la forma de la respuesta no
 *   cambie. Pudo NO verificarse en vivo desde este entorno de desarrollo —
 *   `sri.gob.ec` / `srienlinea.sri.gob.ec` no son alcanzables desde acá — así
 *   que los nombres de campo de abajo están tomados de la documentación
 *   comunitaria de este endpoint, no confirmados contra una respuesta real.
 *   Verificar en el primer uso real (`vercel logs` si falla) y ajustar el
 *   parseo si el SRI devuelve otra forma.
 *
 * Por eso el diseño es defensivo a propósito: cualquier falla (timeout, 404,
 * forma de respuesta inesperada) devuelve `{ found: false }` en vez de un
 * error — nunca bloquea la creación manual del cliente.
 */
import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/app/api/_helpers';

export const dynamic = 'force-dynamic';

const SRI_CONSULTA_URL =
  'https://srienlinea.sri.gob.ec/sri-catastro-sujeto-servicio-internet/rest/ConsolidadoContribuyente/obtenerPorNumeroRuc';

const TIMEOUT_MS = 6000;

interface ResultadoConsulta {
  found: boolean;
  razonSocial?: string;
  tipoContribuyente?: 'PERSONA_NATURAL' | 'SOCIEDAD';
  estado?: string;
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const ruc = (searchParams.get('ruc') ?? '').trim();

  if (!/^\d{13}$/.test(ruc)) {
    return NextResponse.json({ error: 'El RUC debe tener 13 dígitos' }, { status: 400 });
  }

  const resultado = await consultarSRI(ruc);
  return NextResponse.json({ ok: true, data: resultado });
}

async function consultarSRI(ruc: string): Promise<ResultadoConsulta> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${SRI_CONSULTA_URL}?numeroRuc=${ruc}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) return { found: false };

    const json = await res.json().catch(() => null);
    if (!json) return { found: false };

    // Nombres de campo según la documentación comunitaria del endpoint — no
    // confirmados en vivo, ver comentario de cabecera. `razonSocial` es el
    // único campo que realmente necesitamos.
    const razonSocial: unknown = json.razonSocial ?? json.nombre;
    if (typeof razonSocial !== 'string' || !razonSocial.trim()) return { found: false };

    return {
      found: true,
      razonSocial: razonSocial.trim(),
      tipoContribuyente: json.tipoContribuyente === 'PERSONA NATURAL' ? 'PERSONA_NATURAL' : 'SOCIEDAD',
      estado: typeof json.estadoContribuyenteRuc === 'string' ? json.estadoContribuyenteRuc : undefined,
    };
  } catch (e) {
    // Timeout, DNS, endpoint caído o formato inesperado — nunca tirar el
    // request completo por esto, es una mejora de UX, no una dependencia.
    console.warn('[consultar-identificacion] SRI no disponible o formato inesperado:', e);
    return { found: false };
  } finally {
    clearTimeout(timeout);
  }
}
