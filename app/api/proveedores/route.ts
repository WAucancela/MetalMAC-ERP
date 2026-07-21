/**
 * GET  /api/proveedores  — lista proveedores (activos por defecto)
 * POST /api/proveedores  — crea un proveedor
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getAuthenticatedUser, canWrite } from '@/app/api/_helpers';
import { ProveedorSchema, ProveedoresQuerySchema } from '@/lib/validations/sri.schema';
import { mapProveedorRow } from '@/lib/services/mappers';

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const queryParsed = ProveedoresQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!queryParsed.success) {
    return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
  }

  const { activo, q: searchTerm, limit: pageLimit } = queryParsed.data;

  try {
    let query = supabaseAdmin.from('proveedores').select('*').order('razon_social');

    if (activo !== undefined) query = query.eq('activo', activo);
    if (searchTerm) {
      query = query.or(
        `razon_social.ilike.%${searchTerm}%,ruc.ilike.%${searchTerm}%,nombre_comercial.ilike.%${searchTerm}%`,
      );
    }
    query = query.limit(pageLimit);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ ok: true, data: (data ?? []).map(mapProveedorRow) });
  } catch (e) {
    console.error('[GET /api/proveedores]', e);
    return NextResponse.json({ error: 'Error al obtener proveedores' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ error: 'Sin permiso de escritura' }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const parsed = ProveedorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const { data: proveedor, error } = await supabaseAdmin
      .from('proveedores')
      .insert({
        ruc: parsed.data.ruc,
        razon_social: parsed.data.razonSocial,
        nombre_comercial: parsed.data.nombreComercial,
        tipo_contribuyente: parsed.data.tipoContribuyente,
        contribuyente_especial: parsed.data.contribuyenteEspecial,
        obliga_contabilidad: parsed.data.obligaContabilidad,
        agente_retencion: parsed.data.agenteRetencion,
        dias_credito: parsed.data.diasCredito,
        telefono_principal: parsed.data.telefonoPrincipal,
        email_principal: parsed.data.emailPrincipal,
        ciudad: parsed.data.ciudad,
        activo: parsed.data.activo,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: `Ya existe un proveedor con el RUC ${parsed.data.ruc}` },
          { status: 409 },
        );
      }
      throw error;
    }

    return NextResponse.json({ ok: true, id: proveedor.id }, { status: 201 });
  } catch (e) {
    console.error('[POST /api/proveedores]', e);
    return NextResponse.json({ error: 'Error al crear proveedor' }, { status: 500 });
  }
}
