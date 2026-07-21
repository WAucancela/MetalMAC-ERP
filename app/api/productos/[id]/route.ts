import { NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { getAuthenticatedUser, canWrite } from '@/app/api/_helpers';
import { ProductoSchema } from '@/lib/validations/produccion.schema';
import {
  cargarStocksBOM,
  cargarMaterialesBOM,
  validarDisponibilidadBOM,
} from '@/lib/services/bom.service';
import type { BOM } from '@/types/metalmac.types';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const cantidadValidar = searchParams.get('validarStock')
    ? Number(searchParams.get('validarStock'))
    : null;

  const [prodSnap, bomSnap] = await Promise.all([
    adminDb.collection('productos').doc(params.id).get(),
    adminDb.collection('bom').doc(params.id).get(),
  ]);

  if (!prodSnap.exists) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });

  const bom = bomSnap.exists ? ({ productoId: params.id, ...bomSnap.data() } as BOM) : null;

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
      producto: { id: prodSnap.id, ...prodSnap.data() },
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

  const ref = adminDb.collection('productos').doc(params.id);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });

  await ref.update({ ...parsed.data, actualizadoEn: Timestamp.now() });
  return NextResponse.json({ ok: true });
}
