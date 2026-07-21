/**
 * GET /api/bom/[productoId]              — obtiene el BOM
 * PUT /api/bom/[productoId]              — reemplaza el BOM completo (upsert)
 * GET /api/bom/[productoId]?costo=N      — calcula costo para N unidades
 */

import { NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { getAuthenticatedUser, canWrite } from '@/app/api/_helpers';
import { BOMSchema } from '@/lib/validations/produccion.schema';

export async function GET(request: Request, { params }: { params: { productoId: string } }) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const costoUnidades = searchParams.get('costo') ? Number(searchParams.get('costo')) : null;

  const snap = await adminDb.collection('bom').doc(params.productoId).get();
  if (!snap.exists) return NextResponse.json({ error: 'BOM no encontrado' }, { status: 404 });

  const bom = { productoId: params.productoId, ...snap.data() };

  // Si se pide cálculo de costo, cargamos materiales desde admin SDK
  if (costoUnidades && costoUnidades > 0) {
    try {
      const lineas = (bom as { lineas?: { materialId: string }[] }).lineas ?? [];
      const materialIds = [...new Set(lineas.map((l) => l.materialId))];

      // Obtener costos de materiales en batches de 10
      const materialesPorId: Record<string, { nombre: string; costoUnitario: number }> = {};
      const BATCH = 10;
      for (let i = 0; i < materialIds.length; i += BATCH) {
        const batch = materialIds.slice(i, i + BATCH);
        const matSnaps = await Promise.all(batch.map((id) => adminDb.collection('materiales').doc(id).get()));
        matSnaps.forEach((s) => {
          if (s.exists) {
            const d = s.data() as { nombre: string; costoUnitario: number };
            materialesPorId[s.id] = { nombre: d.nombre, costoUnitario: d.costoUnitario };
          }
        });
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
  const prodSnap = await adminDb.collection('productos').doc(params.productoId).get();
  if (!prodSnap.exists) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const parsed = BOMSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 });

  // Calcular cantidadConMerma para cada línea antes de guardar
  const { default: Decimal } = await import('decimal.js');
  const lineasConMerma = parsed.data.lineas.map((l) => ({
    ...l,
    cantidadConMerma: new Decimal(l.cantidadBase).times(l.factorMerma).toDecimalPlaces(6).toNumber(),
  }));

  // Calcular costos de operaciones
  const costoOperaciones = parsed.data.operaciones.reduce((acc, op) => {
    return acc + new Decimal(op.minutos).times(op.costoPorMinuto).toNumber();
  }, 0);

  await adminDb.collection('bom').doc(params.productoId).set({
    lineas: lineasConMerma,
    operaciones: parsed.data.operaciones,
    costoOperaciones: new Decimal(costoOperaciones).toDecimalPlaces(4).toNumber(),
    costoMateriales: 0, // se recalcula en el GET ?costo=N
    costoTotal: 0,
    version: Timestamp.now().seconds, // versión simple basada en timestamp
    actualizadoEn: Timestamp.now(),
    actualizadoPor: user.uid,
  });

  return NextResponse.json({ ok: true });
}
