/**
 * GET   /api/ordenes-produccion/[id]  — detalle de la OP
 * PATCH /api/ordenes-produccion/[id]  — transición de estado
 *
 * Transiciones válidas:
 *   BORRADOR  → EN_PROCESO  : valida stock, reserva materiales, calcula costo estimado
 *   EN_PROCESO → COMPLETADA : consume materiales (SALIDA), registra costo real
 *   EN_PROCESO → CANCELADA  : libera materiales (LIBERACION)
 *   BORRADOR  → CANCELADA   : sin movimientos de stock
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getAuthenticatedUser, canWrite } from '@/app/api/_helpers';
import { ActualizarEstadoOrdenSchema } from '@/lib/validations/produccion.schema';
import {
  reservarMaterialesBOM,
  liberarMaterialesBOM,
  consumirMaterialesBOM,
  cargarBOM,
  cargarStocksBOM,
  calcularCostoProducto,
  validarDisponibilidadBOM,
  BOMNoEncontradoError,
  StockInsuficienteParaOPError,
} from '@/lib/services/bom.service';
import { mapOrdenProduccionRow } from '@/lib/services/mappers';

// Nunca cachear: cada respuesta depende del usuario autenticado y de datos que cambian por request.
export const dynamic = 'force-dynamic';

interface RouteParams { params: { id: string } }

// ─────────────────────────────────────────────
// GET /api/ordenes-produccion/[id]
// ─────────────────────────────────────────────

export async function GET(request: Request, { params }: RouteParams) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const { data: orden, error } = await supabaseAdmin
      .from('ordenes_produccion')
      .select('*, orden_materiales_reservados(*), orden_operaciones(*, operarios(nombre)), productos(id, nombre, codigo)')
      .eq('id', params.id)
      .maybeSingle();
    if (error) throw error;
    if (!orden) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });

    return NextResponse.json({
      ok: true,
      data: {
        ...mapOrdenProduccionRow(orden, orden.orden_materiales_reservados, orden.orden_operaciones),
        producto: orden.productos,
      },
    });
  } catch (e) {
    console.error(`[GET /api/ordenes-produccion/${params.id}]`, e);
    return NextResponse.json({ error: 'Error al obtener orden' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
// PATCH /api/ordenes-produccion/[id]
// ─────────────────────────────────────────────

export async function PATCH(request: Request, { params }: RouteParams) {
  const user = await getAuthenticatedUser(request);
  if (!user)           return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const parsed = ActualizarEstadoOrdenSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 });

  const { estado: nuevoEstado, notas } = parsed.data;

  try {
    const { data: orden, error: ordenError } = await supabaseAdmin
      .from('ordenes_produccion')
      .select('*')
      .eq('id', params.id)
      .maybeSingle();
    if (ordenError) throw ordenError;
    if (!orden) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });

    const estadoActual = orden.estado;

    // ── Validar transiciones permitidas ──────────────────────────────────────
    const transicionesValidas: Record<string, string[]> = {
      BORRADOR:   ['EN_PROCESO', 'CANCELADA'],
      EN_PROCESO: ['COMPLETADA', 'CANCELADA'],
    };

    if (!(transicionesValidas[estadoActual] ?? []).includes(nuevoEstado)) {
      return NextResponse.json(
        { error: `Transición inválida: ${estadoActual} → ${nuevoEstado}` },
        { status: 422 },
      );
    }

    // ── BORRADOR → CANCELADA (sin stock) ────────────────────────────────────
    if (estadoActual === 'BORRADOR' && nuevoEstado === 'CANCELADA') {
      await supabaseAdmin.from('ordenes_produccion').update({
        estado: 'CANCELADA',
        notas: notas ?? orden.notas,
        actualizado_en: new Date().toISOString(),
        actualizado_por: user.uid,
      }).eq('id', params.id);

      return NextResponse.json({ ok: true });
    }

    // ── BORRADOR → EN_PROCESO (reservar materiales) ──────────────────────────
    if (estadoActual === 'BORRADOR' && nuevoEstado === 'EN_PROCESO') {
      const bom = await cargarBOM(orden.producto_id); // 422 vía BOMNoEncontradoError si no existe

      const stockPorId = await cargarStocksBOM(bom.lineas);
      const validacion = validarDisponibilidadBOM(bom, stockPorId, orden.cantidad);
      if (!validacion.valido) {
        return NextResponse.json(
          {
            error: 'Stock insuficiente para iniciar la OP',
            faltantes: validacion.faltantes,
          },
          { status: 422 },
        );
      }

      // Calcular costo estimado
      const costoResult = await calcularCostoProducto(orden.producto_id, orden.cantidad);

      // Reservar materiales — función plpgsql con SELECT ... FOR UPDATE (todo-o-nada)
      await reservarMaterialesBOM(orden.producto_id, orden.cantidad, params.id, user.uid);

      // Snapshot de las operaciones del BOM vigente — si el BOM cambia después,
      // esta OP ya en curso no se ve afectada (mismo criterio que materiales reservados).
      if (bom.operaciones.length > 0) {
        const { error: opsError } = await supabaseAdmin.from('orden_operaciones').insert(
          bom.operaciones.map((op, i) => ({
            orden_id: params.id,
            orden: i + 1,
            tipo: op.tipo,
            minutos_planificados: op.minutos,
            costo_por_minuto: op.costoPorMinuto,
          })),
        );
        if (opsError) throw opsError;
      }

      await supabaseAdmin.from('ordenes_produccion').update({
        estado: 'EN_PROCESO',
        costo_estimado: costoResult.costoTotal,
        notas: notas ?? orden.notas,
        actualizado_en: new Date().toISOString(),
        actualizado_por: user.uid,
      }).eq('id', params.id);

      return NextResponse.json({ ok: true, costoEstimado: costoResult.costoTotal });
    }

    // ── EN_PROCESO → COMPLETADA (consumir materiales) ────────────────────────
    if (estadoActual === 'EN_PROCESO' && nuevoEstado === 'COMPLETADA') {
      const { data: reservados, error: resError } = await supabaseAdmin
        .from('orden_materiales_reservados')
        .select('cantidad_reservada, costo_unitario_al_momento')
        .eq('orden_id', params.id);
      if (resError) throw resError;

      await consumirMaterialesBOM(params.id, user.uid);

      // costoReal = suma de (cantidadReservada * costoUnitarioAlMomento) de cada material reservado
      const costoReal = (reservados ?? []).reduce(
        (acc, m) => acc + Number(m.cantidad_reservada) * Number(m.costo_unitario_al_momento),
        0,
      );

      await supabaseAdmin.from('ordenes_produccion').update({
        estado: 'COMPLETADA',
        costo_real: costoReal,
        fecha_completada: new Date().toISOString(),
        notas: notas ?? orden.notas,
        actualizado_en: new Date().toISOString(),
        actualizado_por: user.uid,
      }).eq('id', params.id);

      // Si la OP pertenece a un proyecto, se registra su costo real como un
      // gasto — el trigger existente sobre `gastos` suma automáticamente a
      // proyectos.costo_real, sin duplicar lógica de suma acá. Un fallo en
      // este paso NO hace fallar la respuesta: la OP ya quedó completada y los
      // materiales ya se consumieron, que es lo irreversible; la sincronización
      // contable es secundaria y se puede resolver aparte si falla (mismo
      // criterio que el bloque de RIDE/email en facturas-venta/[id]/emitir).
      let gastoProyectoRegistrado = false;
      if (orden.proyecto_id && costoReal > 0) {
        try {
          const { error: gastoError } = await supabaseAdmin.from('gastos').insert({
            proyecto_id: orden.proyecto_id,
            categoria: 'PRODUCCION',
            descripcion: `Consumo de producción — ${orden.codigo}`,
            monto: costoReal,
            fecha: new Date().toISOString().slice(0, 10),
            orden_id: params.id,
            creado_por: user.uid,
          });
          if (gastoError) throw gastoError;
          gastoProyectoRegistrado = true;
        } catch (e) {
          console.error(`[PATCH /api/ordenes-produccion/${params.id}] OP completada pero no se pudo registrar el gasto de producción en el proyecto`, e);
        }
      }

      return NextResponse.json({ ok: true, costoReal, gastoProyectoRegistrado });
    }

    // ── EN_PROCESO → CANCELADA (liberar materiales) ──────────────────────────
    if (estadoActual === 'EN_PROCESO' && nuevoEstado === 'CANCELADA') {
      await liberarMaterialesBOM(params.id, user.uid);

      await supabaseAdmin.from('ordenes_produccion').update({
        estado: 'CANCELADA',
        notas: notas ?? orden.notas,
        actualizado_en: new Date().toISOString(),
        actualizado_por: user.uid,
      }).eq('id', params.id);

      return NextResponse.json({ ok: true });
    }

    // No debería llegar aquí
    return NextResponse.json({ error: 'Transición no manejada' }, { status: 500 });

  } catch (e) {
    if (e instanceof BOMNoEncontradoError) {
      return NextResponse.json({ error: e.message }, { status: 422 });
    }
    if (e instanceof StockInsuficienteParaOPError) {
      return NextResponse.json(
        { error: 'Stock insuficiente', detalle: e.message },
        { status: 422 },
      );
    }
    console.error(`[PATCH /api/ordenes-produccion/${params.id}]`, e);
    return NextResponse.json({ error: 'Error al actualizar orden' }, { status: 500 });
  }
}
