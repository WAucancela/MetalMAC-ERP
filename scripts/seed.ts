/**
 * scripts/seed.ts — Poblar Postgres con catálogos iniciales.
 *
 * Uso:
 *   npx tsx scripts/seed.ts
 *
 * Requiere NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local
 * (o exportadas en la terminal antes de correr el script).
 *
 * Solo inserta filas que no existen por nombre (idempotente) — a diferencia de
 * Firestore, las filas usan uuid autogenerado, así que la idempotencia se
 * chequea por `nombre`, no por un id fijo de antemano.
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase.types';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

// ── Helpers ───────────────────────────────────────────────────────────────────

async function upsertPorNombre(
  tabla: 'unidades_medida' | 'categorias',
  nombre: string,
  data: Record<string, unknown>,
): Promise<void> {
  const { data: existente, error: selectError } = await supabase
    .from(tabla)
    .select('id')
    .eq('nombre', nombre)
    .maybeSingle();
  if (selectError) throw selectError;

  if (existente) {
    console.log(`  · ${tabla}/${nombre} ya existe, omitido`);
    return;
  }

  const { error: insertError } = await supabase.from(tabla).insert({ nombre, ...data });
  if (insertError) throw insertError;
  console.log(`  ✓ ${tabla}/${nombre}`);
}

// ── Datos de seed ─────────────────────────────────────────────────────────────
// `tipo` usa el enum tipo_unidad_medida real (PESO|LONGITUD|AREA|VOLUMEN|UNIDAD).

const UNIDADES_MEDIDA = [
  { nombre: 'Kilogramo',      simbolo: 'kg',    tipo: 'PESO' },
  { nombre: 'Gramo',          simbolo: 'g',     tipo: 'PESO' },
  { nombre: 'Litro',          simbolo: 'lt',    tipo: 'VOLUMEN' },
  { nombre: 'Mililitro',      simbolo: 'ml',    tipo: 'VOLUMEN' },
  { nombre: 'Metro',          simbolo: 'm',     tipo: 'LONGITUD' },
  { nombre: 'Centímetro',     simbolo: 'cm',    tipo: 'LONGITUD' },
  { nombre: 'Milímetro',      simbolo: 'mm',    tipo: 'LONGITUD' },
  { nombre: 'Metro cuadrado', simbolo: 'm²',    tipo: 'AREA' },
  { nombre: 'Metro cúbico',   simbolo: 'm³',    tipo: 'VOLUMEN' },
  { nombre: 'Metro lineal',   simbolo: 'ml',    tipo: 'LONGITUD' },
  { nombre: 'Unidad',         simbolo: 'und',   tipo: 'UNIDAD' },
  { nombre: 'Pieza',          simbolo: 'pza',   tipo: 'UNIDAD' },
  { nombre: 'Par',            simbolo: 'par',   tipo: 'UNIDAD' },
  { nombre: 'Rollo',          simbolo: 'rollo', tipo: 'UNIDAD' },
  { nombre: 'Lámina',         simbolo: 'lam',   tipo: 'UNIDAD' },
  { nombre: 'Barra',          simbolo: 'barra', tipo: 'UNIDAD' },
  { nombre: 'Tubo',           simbolo: 'tubo',  tipo: 'UNIDAD' },
  { nombre: 'Galón',          simbolo: 'gal',   tipo: 'VOLUMEN' },
] as const;

const CATEGORIAS_MATERIAL = [
  { nombre: 'Aceros y metales',       descripcion: 'Planchas, tubos, perfiles, barras de acero y otros metales' },
  { nombre: 'Insumos de producción',  descripcion: 'Electrodos, discos de corte, brocas, consumibles varios' },
  { nombre: 'Pinturas y recubrimientos', descripcion: 'Pintura anticorrosiva, esmalte, galvanizado en frío' },
  { nombre: 'Materiales eléctricos',  descripcion: 'Cable, conduit, cajas, tableros para luminarias' },
  { nombre: 'Tornillería y fijaciones', descripcion: 'Tornillos, tuercas, pernos, arandelas' },
  { nombre: 'Herramientas y equipos', descripcion: 'Herramientas manuales, equipos de medición, EPP' },
  { nombre: 'Madera y aglomerados',   descripcion: 'Tableros, madera para lockers y mobiliario' },
  { nombre: 'Vidrio y acrílicos',     descripcion: 'Vidrio templado, policarbonato, acrílico' },
  { nombre: 'Químicos y solventes',   descripcion: 'Thinner, acetona, desengrasante, fluxante' },
  { nombre: 'Embalaje y empaque',     descripcion: 'Cinta, stretch film, cartón, espuma' },
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Iniciando seed de Postgres...\n');

  console.log('📐 Unidades de medida:');
  for (const { nombre, ...data } of UNIDADES_MEDIDA) {
    await upsertPorNombre('unidades_medida', nombre, data);
  }

  console.log('\n📦 Categorías de material:');
  for (const { nombre, ...data } of CATEGORIAS_MATERIAL) {
    await upsertPorNombre('categorias', nombre, data);
  }

  console.log('\n✅ Seed completado.');
}

main().catch((err) => {
  console.error('❌ Error en seed:', err);
  process.exit(1);
});
