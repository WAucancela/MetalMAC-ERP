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
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { getAuthenticatedUser, canWrite } from '@/app/api/_helpers';
import { ActualizarEstadoOrdenSchema } from '@/lib/validations/produccion.schema';
import {
  reservarMaterialesBOM,
  liberarMaterialesBOM,
  consumirMaterialesBOM,
  calcularCostoProducto,
  validarDisponibilidadBOM,
  BOMNoEncontradoError,
  StockInsuficienteParaOPError,
} from '@/lib/services/bom.service';
import type { BOM, OrdenProduccion } from '@/types/metalmac.types';

interface RouteParams { params: { id: string } }

// ─────────────────────────────────────────────
// GET /api/ordenes-produccion/[id]
// ─────────────────────────────────────────────

export async function GET(request: Request, { params }: RouteParams) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const snap = await adminDb.collection('ordenes_produccion').doc(params.id).get();
    if (!snap.exists) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });

    const orden = { id: snap.id, ...snap.data() } as OrdenProduccion & { id: string };

    // Enriquecer con datos del producto (nombre, codigo)
    const prodSnap = await adminDb.collection('productos').doc(orden.productoId).get();
    const producto = prodSnap.exists
      ? { id: prodSnap.id, nombre: prodSnap.data()?.nombre, codigo: prodSnap.data()?.codigo }
      : null;

    return NextResponse.json({ ok: true, data: { ...orden, producto } });
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
    const ordenRef = adminDb.collection('ordenes_produccion').doc(params.id);
    const ordenSnap = await ordenRef.get();
    if (!ordenSnap.exists) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });

    const orden = ordenSnap.data() as OrdenProduccion;
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
      await ordenRef.update({
        estado: 'CANCELADA',
        notas: notas ?? orden.notas,
        actualizadoEn: Timestamp.now(),
        actualizadoPor: user.uid,
      });
      return NextResponse.json({ ok: true });
    }

    // ── BORRADOR → EN_PROCESO (reservar materiales) ──────────────────────────
    if (estadoActual === 'BORRADOR' && nuevoEstado === 'EN_PROCESO') {
      const bomSnap = await adminDb.collection('bom').doc(orden.productoId).get();
      if (!bomSnap.exists) {
        return NextResponse.json(
          { error: 'El producto no tiene BOM configurado' },
          { status: 422 },
        );
      }
      const bom = { productoId: bomSnap.id, ...bomSnap.data()! } as BOM;

      // Cargar unidades para cálculo de merma
      const unidadesSnap = await adminDb.collection('unidades_medida').get();
      const unidadesMap = Object.fromEntries(
        unidadesSnap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]),
      ) as Record<string, any>;
      const unidades = orden.cantidad;

      // Cargar stocks para validar disponibilidad
      const materialIds = bom.lineas.map((l) => l.materialId);
      const stockSnapsPre: Record<string, any> = {};
      // whereIn en batches de 10
      for (let i = 0; i < materialIds.length; i += 10) {
        const batch = materialIds.slice(i, i + 10);
        const sSnap = await adminDb
          .collection('stock')
          .where('materialId', 'in', batch)
          .get();
        sSnap.docs.forEach((d) => {
          stockSnapsPre[d.data().materialId] = { id: d.id, ...d.data() };
        });
      }

      const validacion = validarDisponibilidadBOM(bom, stockSnapsPre, unidades);
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
      const costoResult = await calcularCostoProducto(orden.productoId, orden.cantidad);

      // Reservar materiales (Firestore Transaction dentro de bom.service)
      const materialesReservados = await reservarMaterialesBOM(
        bom,
        orden.cantidad,
        params.id,
        user.uid,
      );

      await ordenRef.update({
        estado: 'EN_PROCESO',
        materialesReservados,
        costoEstimado: costoResult.costoTotal,
        notas: notas ?? orden.notas,
        actualizadoEn: Timestamp.now(),
        actualizadoPor: user.uid,
      });

      return NextResponse.json({ ok: true, costoEstimado: costoResult.costoTotal });
    }

    // ── EN_PROCESO → COMPLETADA (consumir materiales) ────────────────────────
    if (estadoActual === 'EN_PROCESO' && nuevoEstado === 'COMPLETADA') {
      const materialesReservados = orden.materialesReservados ?? [];

      await consumirMaterialesBOM(materialesReservados, params.id, user.uid);

      // costoReal = suma de (cantidadConsumida * costoUnitarioAlMomento) de cada material reservado
      const costoReal = materialesReservados.reduce(
        (acc, m) => acc + (m.cantidadReservada ?? 0) * (m.costoUnitarioAlMomento ?? 0),
        0,
      );

      await ordenRef.update({
        estado: 'COMPLETADA',
        costoReal,
        fechaCompletada: Timestamp.now(),
        notas: notas ?? orden.notas,
        actualizadoEn: Timestamp.now(),
        actualizadoPor: user.uid,
      });

      return NextResponse.json({ ok: true, costoReal });
    }

    // ── EN_PROCESO → CANCELADA (liberar materiales) ──────────────────────────
    if (estadoActual === 'EN_PROCESO' && nuevoEstado === 'CANCELADA') {
      const materialesReservados = orden.materialesReservados ?? [];

      await liberarMaterialesBOM(materialesReservados, params.id, user.uid);

      await ordenRef.update({
        estado: 'CANCELADA',
        notas: notas ?? orden.notas,
        actualizadoEn: Timestamp.now(),
        actualizadoPor: user.uid,
      });

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
