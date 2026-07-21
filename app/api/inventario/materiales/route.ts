/**
 * GET  /api/inventario/materiales   → lista paginada de materiales
 * POST /api/inventario/materiales   → crear material
 */
import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  CreateMaterialSchema,
  MaterialesQuerySchema,
} from '@/lib/validations/inventario.schema';
import {
  ok, created, badRequest, unauthorized, forbidden,
  fromZodError, internalError, getAuthenticatedUser, canWrite,
} from '@/app/api/_helpers';
import { mapMaterialRow, mapStockRow } from '@/lib/services/mappers';

// GET — lista materiales + stock actual
export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorized();

  const parsed = MaterialesQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!parsed.success) return fromZodError(parsed.error);

  const { tipo, activo, q, limite } = parsed.data;

  try {
    let query = supabaseAdmin
      .from('materiales')
      .select('*, stock(*)')
      .order('nombre');

    if (tipo) query = query.eq('tipo', tipo);
    if (activo !== undefined) query = query.eq('activo', activo);
    if (q) query = query.or(`nombre.ilike.%${q}%,codigo_interno.ilike.%${q}%`);
    query = query.limit(limite);

    const { data, error } = await query;
    if (error) throw error;

    const materiales = (data ?? []).map((row) => ({
      ...mapMaterialRow(row),
      stock: row.stock ? mapStockRow(row.stock) : null,
    }));

    return ok(materiales);
  } catch (err) {
    console.error('[GET /materiales]', err);
    return internalError();
  }
}

// POST — crear material
export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user)           return unauthorized();
  if (!canWrite(user)) return forbidden('Solo GERENTE o BODEGUERO pueden crear materiales');

  const body = await request.json().catch(() => null);
  if (!body) return badRequest('Body inválido o vacío');

  const parsed = CreateMaterialSchema.safeParse(body);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const { data: material, error } = await supabaseAdmin
      .from('materiales')
      .insert({
        codigo_interno: parsed.data.codigoInterno,
        nombre: parsed.data.nombre,
        descripcion: parsed.data.descripcion,
        tipo: parsed.data.tipo,
        categoria_id: parsed.data.categoriaId,
        grado: parsed.data.grado,
        unidad_base_id: parsed.data.unidadBaseId,
        costo_unitario: parsed.data.costoUnitario,
        especificaciones: parsed.data.especificaciones,
        activo: parsed.data.activo,
      })
      .select()
      .single();
    if (error) throw error;

    // Crear fila de stock en 0
    const { error: stockError } = await supabaseAdmin.from('stock').insert({
      material_id: material.id,
      cantidad_disponible: 0,
      cantidad_reservada: 0,
      cantidad_minima: 0,
      cantidad_maxima: null,
      ubicacion: '',
    });
    if (stockError) throw stockError;

    return created(mapMaterialRow(material));
  } catch (err) {
    console.error('[POST /materiales]', err);
    return internalError();
  }
}
