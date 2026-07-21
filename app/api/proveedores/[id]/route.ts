/**
 * GET    /api/proveedores/[id]  — detalle de proveedor + últimas facturas
 * PUT    /api/proveedores/[id]  — actualiza proveedor
 * DELETE /api/proveedores/[id]  — soft delete (activo: false)
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getAuthenticatedUser, canWrite } from '@/app/api/_helpers';
import { ProveedorSchema } from '@/lib/validations/sri.schema';
import { mapProveedorRow } from '@/lib/services/mappers';
import type { Database } from '@/types/supabase.types';

type ProveedorUpdate = Database['public']['Tables']['proveedores']['Update'];

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const [{ data: proveedorRow, error: provError }, { data: facturasRows, error: facturasError }] = await Promise.all([
    supabaseAdmin.from('proveedores').select('*').eq('id', params.id).maybeSingle(),
    supabaseAdmin
      .from('facturas_compra')
      .select('id, numero_factura, clave_acceso, fecha_emision, subtotal_sin_iva, iva, total, estado')
      .eq('proveedor_id', params.id)
      .order('fecha_emision', { ascending: false })
      .limit(10),
  ]);
  if (provError) return NextResponse.json({ error: 'Error al obtener proveedor' }, { status: 500 });
  if (facturasError) return NextResponse.json({ error: 'Error al obtener facturas' }, { status: 500 });
  if (!proveedorRow) return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });

  const facturas = (facturasRows ?? []).map((f) => ({
    id: f.id,
    numeroFactura: f.numero_factura,
    claveAcceso: f.clave_acceso,
    fechaEmision: f.fecha_emision,
    subtotalSinIva: Number(f.subtotal_sin_iva),
    iva: Number(f.iva),
    total: Number(f.total),
    estado: f.estado,
  }));

  return NextResponse.json({ ok: true, data: { proveedor: mapProveedorRow(proveedorRow), facturas } });
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ error: 'Sin permiso de escritura' }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const parsed = ProveedorSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 });
  }

  const update: ProveedorUpdate = {};
  if (parsed.data.ruc !== undefined)                    update.ruc = parsed.data.ruc;
  if (parsed.data.razonSocial !== undefined)             update.razon_social = parsed.data.razonSocial;
  if (parsed.data.nombreComercial !== undefined)         update.nombre_comercial = parsed.data.nombreComercial;
  if (parsed.data.tipoContribuyente !== undefined)       update.tipo_contribuyente = parsed.data.tipoContribuyente;
  if (parsed.data.contribuyenteEspecial !== undefined)   update.contribuyente_especial = parsed.data.contribuyenteEspecial;
  if (parsed.data.obligaContabilidad !== undefined)      update.obliga_contabilidad = parsed.data.obligaContabilidad;
  if (parsed.data.agenteRetencion !== undefined)         update.agente_retencion = parsed.data.agenteRetencion;
  if (parsed.data.diasCredito !== undefined)             update.dias_credito = parsed.data.diasCredito;
  if (parsed.data.telefonoPrincipal !== undefined)       update.telefono_principal = parsed.data.telefonoPrincipal;
  if (parsed.data.emailPrincipal !== undefined)          update.email_principal = parsed.data.emailPrincipal;
  if (parsed.data.ciudad !== undefined)                  update.ciudad = parsed.data.ciudad;
  if (parsed.data.activo !== undefined)                  update.activo = parsed.data.activo;

  const { data: updated, error } = await supabaseAdmin
    .from('proveedores')
    .update(update)
    .eq('id', params.id)
    .select()
    .maybeSingle();
  if (error) return NextResponse.json({ error: 'Error al actualizar proveedor' }, { status: 500 });
  if (!updated) return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ error: 'Sin permiso de escritura' }, { status: 403 });

  const { data: updated, error } = await supabaseAdmin
    .from('proveedores')
    .update({ activo: false })
    .eq('id', params.id)
    .select()
    .maybeSingle();
  if (error) return NextResponse.json({ error: 'Error al desactivar proveedor' }, { status: 500 });
  if (!updated) return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });

  return NextResponse.json({ ok: true });
}
