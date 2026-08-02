import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getAuthenticatedUser, canWrite } from '@/app/api/_helpers';
import { ProductoSchema } from '@/lib/validations/produccion.schema';
import {
  cargarStocksBOM,
  cargarMaterialesBOM,
  validarDisponibilidadBOM,
} from '@/lib/services/bom.service';
import { mapProductoRow } from '@/lib/services/mappers';
import type { BOM, LineaBOM, OperacionBOM } from '@/types/metalmac.types';
import type { Database } from '@/types/supabase.types';

// Nunca cachear: cada respuesta depende del usuario autenticado y de datos que cambian por request.
export const dynamic = 'force-dynamic';

type ProductoUpdate = Database['public']['Tables']['productos']['Update'];

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const cantidadValidar = searchParams.get('validarStock')
    ? Number(searchParams.get('validarStock'))
    : null;

  const [{ data: producto, error: prodError }, { data: bomRow, error: bomError }] = await Promise.all([
    supabaseAdmin.from('productos').select('*').eq('id', params.id).maybeSingle(),
    supabaseAdmin
      .from('boms')
      .select('producto_id, version, costo_materiales, costo_operaciones, costo_total, actualizado_en, bom_lineas(*), bom_operaciones(*)')
      .eq('producto_id', params.id)
      .maybeSingle(),
  ]);
  if (prodError) return NextResponse.json({ error: 'Error al obtener producto' }, { status: 500 });
  if (bomError) return NextResponse.json({ error: 'Error al obtener BOM' }, { status: 500 });
  if (!producto) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });

  const bom: BOM | null = bomRow ? {
    productoId: bomRow.producto_id,
    version: bomRow.version,
    lineas: [...bomRow.bom_lineas]
      .sort((a, b) => a.orden - b.orden)
      .map((l): LineaBOM => ({
        materialId: l.material_id,
        cantidadBase: Number(l.cantidad_base),
        factorMerma: Number(l.factor_merma),
        cantidadConMerma: Number(l.cantidad_con_merma),
        unidadId: l.unidad_id,
        notas: l.notas,
      })),
    operaciones: [...bomRow.bom_operaciones]
      .sort((a, b) => a.orden - b.orden)
      .map((o): OperacionBOM => ({
        tipo: o.tipo,
        minutos: Number(o.minutos),
        costoPorMinuto: Number(o.costo_por_minuto),
        costoTotal: Number(o.costo_total),
      })),
    costoMateriales: Number(bomRow.costo_materiales),
    costoOperaciones: Number(bomRow.costo_operaciones),
    costoTotal: Number(bomRow.costo_total),
    actualizadoEn: bomRow.actualizado_en,
  } : null;

  // Validación de stock en tiempo real (usada por el formulario de crear OP)
  let validacion: { valido: boolean; faltantes: Array<{ materialId: string; nombre?: string; faltante: number }> } | null = null;

  if (cantidadValidar && cantidadValidar > 0) {
    if (!bom) {
      validacion = { valido: false, faltantes: [] };
    } else {
      const [stockPorId, materialesPorId] = await Promise.all([
        cargarStocksBOM(bom.lineas),
        cargarMaterialesBOM(bom.lineas),
      ]);

      const resultado = validarDisponibilidadBOM(bom, stockPorId, cantidadValidar);
      validacion = {
        valido: resultado.valido,
        faltantes: resultado.faltantes.map((f) => ({
          materialId: f.materialId,
          nombre: materialesPorId[f.materialId]?.nombre,
          faltante: f.deficit,
        })),
      };
    }
  }

  return NextResponse.json({
    ok: true,
    data: {
      producto: mapProductoRow(producto),
      bom,
    },
    validacion,
  });
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const user = await getAuthenticatedUser(request);
  if (!user)           return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const parsed = ProductoSchema.partial().safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 });

  const update: ProductoUpdate = {};
  if (parsed.data.codigo !== undefined)       update.codigo = parsed.data.codigo;
  if (parsed.data.nombre !== undefined)       update.nombre = parsed.data.nombre;
  if (parsed.data.descripcion !== undefined)  update.descripcion = parsed.data.descripcion;
  if (parsed.data.tipo !== undefined)         update.tipo = parsed.data.tipo;
  if (parsed.data.unidadVenta !== undefined)  update.unidad_venta = parsed.data.unidadVenta;
  if (parsed.data.precioVenta !== undefined)  update.precio_venta = parsed.data.precioVenta;
  if (parsed.data.activo !== undefined)       update.activo = parsed.data.activo;

  const { data: updated, error } = await supabaseAdmin
    .from('productos')
    .update(update)
    .eq('id', params.id)
    .select()
    .maybeSingle();
  if (error) return NextResponse.json({ error: 'Error al actualizar producto' }, { status: 500 });
  if (!updated) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });

  return NextResponse.json({ ok: true });
}
