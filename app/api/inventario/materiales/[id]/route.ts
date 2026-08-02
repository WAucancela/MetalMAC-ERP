/**
 * GET    /api/inventario/materiales/[id]  → detalle + stock + movimientos recientes
 * PUT    /api/inventario/materiales/[id]  → actualizar material
 * DELETE /api/inventario/materiales/[id]  → desactivar (soft-delete)
 */
import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { UpdateMaterialSchema, type UpdateMaterialInput } from '@/lib/validations/inventario.schema';
import {
  ok, badRequest, unauthorized, forbidden, notFound,
  fromZodError, internalError, getAuthenticatedUser, canWrite,
} from '@/app/api/_helpers';
import { mapMaterialRow, mapStockRow, mapMovimientoRow } from '@/lib/services/mappers';
import type { Database } from '@/types/supabase.types';

// Nunca cachear: cada respuesta depende del usuario autenticado y de datos que cambian por request.
export const dynamic = 'force-dynamic';

type RouteContext = { params: { id: string } };
type MaterialUpdate = Database['public']['Tables']['materiales']['Update'];

function buildMaterialUpdate(data: Partial<UpdateMaterialInput>): MaterialUpdate {
  const update: MaterialUpdate = {};
  if (data.codigoInterno !== undefined)    update.codigo_interno = data.codigoInterno;
  if (data.nombre !== undefined)           update.nombre = data.nombre;
  if (data.descripcion !== undefined)      update.descripcion = data.descripcion;
  if (data.tipo !== undefined)             update.tipo = data.tipo;
  if (data.categoriaId !== undefined)      update.categoria_id = data.categoriaId;
  if (data.grado !== undefined)            update.grado = data.grado;
  if (data.unidadBaseId !== undefined)     update.unidad_base_id = data.unidadBaseId;
  if (data.costoUnitario !== undefined)    update.costo_unitario = data.costoUnitario;
  if (data.especificaciones !== undefined) update.especificaciones = data.especificaciones;
  if (data.activo !== undefined)           update.activo = data.activo;
  update.modificado_en = new Date().toISOString();
  return update;
}

// GET — detalle
export async function GET(request: NextRequest, { params }: RouteContext) {
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorized();

  try {
    const [{ data: material, error: materialError }, { data: stock, error: stockError }] = await Promise.all([
      supabaseAdmin.from('materiales').select('*').eq('id', params.id).maybeSingle(),
      supabaseAdmin.from('stock').select('*').eq('material_id', params.id).maybeSingle(),
    ]);
    if (materialError) throw materialError;
    if (stockError) throw stockError;
    if (!material) return notFound('Material no encontrado');

    // Últimos 20 movimientos
    const { data: movimientos, error: movError } = await supabaseAdmin
      .from('movimientos_inventario')
      .select('*')
      .eq('material_id', params.id)
      .order('fecha', { ascending: false })
      .limit(20);
    if (movError) throw movError;

    return ok({
      material:    mapMaterialRow(material),
      stock:       stock ? mapStockRow(stock) : null,
      movimientos: (movimientos ?? []).map(mapMovimientoRow),
    });
  } catch (err) {
    console.error('[GET /materiales/:id]', err);
    return internalError();
  }
}

// PUT — actualizar
export async function PUT(request: NextRequest, { params }: RouteContext) {
  const user = await getAuthenticatedUser(request);
  if (!user)           return unauthorized();
  if (!canWrite(user)) return forbidden();

  const body = await request.json().catch(() => null);
  if (!body) return badRequest('Body inválido');

  const parsed = UpdateMaterialSchema.safeParse(body);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const { data: updated, error } = await supabaseAdmin
      .from('materiales')
      .update(buildMaterialUpdate(parsed.data))
      .eq('id', params.id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!updated) return notFound('Material no encontrado');

    return ok(mapMaterialRow(updated));
  } catch (err) {
    console.error('[PUT /materiales/:id]', err);
    return internalError();
  }
}

// DELETE — soft delete (activo = false)
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const user = await getAuthenticatedUser(request);
  if (!user)           return unauthorized();
  if (!canWrite(user)) return forbidden();

  try {
    const { data: updated, error } = await supabaseAdmin
      .from('materiales')
      .update({ activo: false, modificado_en: new Date().toISOString() })
      .eq('id', params.id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!updated) return notFound('Material no encontrado');

    return ok({ id: params.id, activo: false });
  } catch (err) {
    console.error('[DELETE /materiales/:id]', err);
    return internalError();
  }
}
