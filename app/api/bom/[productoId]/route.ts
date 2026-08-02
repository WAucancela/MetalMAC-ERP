/**
 * GET /api/bom/[productoId]              — obtiene el BOM
 * PUT /api/bom/[productoId]              — reemplaza el BOM completo (upsert)
 * GET /api/bom/[productoId]?costo=N      — calcula costo para N unidades
 */

import { NextResponse } from 'next/server';
import Decimal from 'decimal.js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getAuthenticatedUser, canWrite } from '@/app/api/_helpers';
import { BOMSchema } from '@/lib/validations/produccion.schema';

// Nunca cachear: cada respuesta depende del usuario autenticado y de datos que cambian por request.
export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { productoId: string } }) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const costoUnidades = searchParams.get('costo') ? Number(searchParams.get('costo')) : null;

  const { data: bomRow, error: bomError } = await supabaseAdmin
    .from('boms')
    .select('producto_id, version, costo_materiales, costo_operaciones, costo_total, actualizado_en, bom_lineas(*), bom_operaciones(*)')
    .eq('producto_id', params.productoId)
    .maybeSingle();
  if (bomError) return NextResponse.json({ error: 'Error al obtener BOM' }, { status: 500 });
  if (!bomRow) return NextResponse.json({ error: 'BOM no encontrado' }, { status: 404 });

  const lineas = [...bomRow.bom_lineas].sort((a, b) => a.orden - b.orden).map((l) => ({
    materialId: l.material_id,
    cantidadBase: Number(l.cantidad_base),
    factorMerma: Number(l.factor_merma),
    cantidadConMerma: Number(l.cantidad_con_merma),
    unidadId: l.unidad_id,
    notas: l.notas,
  }));
  const operaciones = [...bomRow.bom_operaciones].sort((a, b) => a.orden - b.orden).map((o) => ({
    tipo: o.tipo,
    minutos: Number(o.minutos),
    costoPorMinuto: Number(o.costo_por_minuto),
    costoTotal: Number(o.costo_total),
  }));

  const bom = {
    productoId: bomRow.producto_id,
    version: bomRow.version,
    lineas,
    operaciones,
    costoMateriales: Number(bomRow.costo_materiales),
    costoOperaciones: Number(bomRow.costo_operaciones),
    costoTotal: Number(bomRow.costo_total),
    actualizadoEn: bomRow.actualizado_en,
  };

  // Si se pide cálculo de costo, cargamos materiales (un solo round trip, sin el
  // límite de 10 del whereIn de Firestore)
  if (costoUnidades && costoUnidades > 0) {
    try {
      const materialIds = [...new Set(lineas.map((l) => l.materialId))];
      const materialesPorId: Record<string, { nombre: string; costoUnitario: number }> = {};

      if (materialIds.length > 0) {
        const { data: materiales, error: matError } = await supabaseAdmin
          .from('materiales')
          .select('id, nombre, costo_unitario')
          .in('id', materialIds);
        if (matError) throw matError;
        for (const m of materiales ?? []) {
          materialesPorId[m.id] = { nombre: m.nombre, costoUnitario: Number(m.costo_unitario) };
        }
      }

      return NextResponse.json({ ok: true, data: bom, materialesPorId, unidades: costoUnidades });
    } catch (e) {
      console.error('[GET /api/bom costo]', e);
    }
  }

  return NextResponse.json({ ok: true, data: bom });
}

export async function PUT(request: Request, { params }: { params: { productoId: string } }) {
  const user = await getAuthenticatedUser(request);
  if (!user)           return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  // Verificar que el producto existe
  const { data: producto, error: prodError } = await supabaseAdmin
    .from('productos')
    .select('id')
    .eq('id', params.productoId)
    .maybeSingle();
  if (prodError) return NextResponse.json({ error: 'Error al verificar producto' }, { status: 500 });
  if (!producto) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const parsed = BOMSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 });

  // Calcular cantidadConMerma para cada línea antes de guardar
  const lineasConMerma = parsed.data.lineas.map((l) => ({
    ...l,
    cantidadConMerma: new Decimal(l.cantidadBase).times(l.factorMerma).toDecimalPlaces(6).toNumber(),
  }));

  // Calcular costos de operaciones
  const costoOperaciones = parsed.data.operaciones.reduce((acc, op) => {
    return acc + new Decimal(op.minutos).times(op.costoPorMinuto).toNumber();
  }, 0);

  try {
    // Versión: lee la actual (si existe) e incrementa — no es una ruta de alta
    // concurrencia (un solo taller, escrituras administrativas), así que no
    // hace falta una función RPC para esto (a diferencia de las 4 críticas de stock).
    const { data: existente } = await supabaseAdmin
      .from('boms')
      .select('version')
      .eq('producto_id', params.productoId)
      .maybeSingle();
    const nuevaVersion = (existente?.version ?? 0) + 1;

    // Reemplazo completo: borra las líneas/operaciones anteriores y reinserta las nuevas.
    await supabaseAdmin.from('bom_lineas').delete().eq('bom_producto_id', params.productoId);
    await supabaseAdmin.from('bom_operaciones').delete().eq('bom_producto_id', params.productoId);

    const { error: upsertError } = await supabaseAdmin.from('boms').upsert({
      producto_id: params.productoId,
      version: nuevaVersion,
      costo_materiales: 0, // se recalcula en el GET ?costo=N
      costo_operaciones: new Decimal(costoOperaciones).toDecimalPlaces(4).toNumber(),
      costo_total: 0,
      actualizado_en: new Date().toISOString(),
    });
    if (upsertError) throw upsertError;

    if (lineasConMerma.length > 0) {
      const { error: lineasError } = await supabaseAdmin.from('bom_lineas').insert(
        lineasConMerma.map((l, orden) => ({
          bom_producto_id: params.productoId,
          orden,
          material_id: l.materialId,
          cantidad_base: l.cantidadBase,
          factor_merma: l.factorMerma,
          cantidad_con_merma: l.cantidadConMerma,
          unidad_id: l.unidadId,
          notas: l.notas ?? '',
        })),
      );
      if (lineasError) throw lineasError;
    }

    if (parsed.data.operaciones.length > 0) {
      const { error: opsError } = await supabaseAdmin.from('bom_operaciones').insert(
        parsed.data.operaciones.map((op, orden) => ({
          bom_producto_id: params.productoId,
          orden,
          tipo: op.tipo,
          minutos: op.minutos,
          costo_por_minuto: op.costoPorMinuto,
          costo_total: new Decimal(op.minutos).times(op.costoPorMinuto).toDecimalPlaces(4).toNumber(),
        })),
      );
      if (opsError) throw opsError;
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[PUT /api/bom]', e);
    return NextResponse.json({ error: 'Error al guardar BOM' }, { status: 500 });
  }
}
