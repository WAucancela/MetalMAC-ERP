/**
 * scripts/seed.ts — Poblar Firestore con catálogos iniciales.
 *
 * Uso:
 *   npx tsx scripts/seed.ts
 *
 * Requiere las variables de entorno del Admin SDK en .env.local
 * (o exportadas en la terminal antes de correr el script).
 *
 * Solo inserta documentos que no existen (idempotente).
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import * as admin from 'firebase-admin';

// ── Init ──────────────────────────────────────────────────────────────────────

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_ADMIN_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
      privateKey:  process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

// ── Helpers ───────────────────────────────────────────────────────────────────

async function upsert(
  collection: string,
  id: string,
  data: Record<string, unknown>,
): Promise<void> {
  const ref = db.collection(collection).doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({ ...data, creadoEn: admin.firestore.FieldValue.serverTimestamp() });
    console.log(`  ✓ ${collection}/${id}`);
  } else {
    console.log(`  · ${collection}/${id} ya existe, omitido`);
  }
}

// ── Datos de seed ─────────────────────────────────────────────────────────────

const UNIDADES_MEDIDA = [
  { id: 'kg',    nombre: 'Kilogramo',       simbolo: 'kg',   tipo: 'MASA' },
  { id: 'g',     nombre: 'Gramo',           simbolo: 'g',    tipo: 'MASA' },
  { id: 'lt',    nombre: 'Litro',           simbolo: 'lt',   tipo: 'VOLUMEN' },
  { id: 'ml',    nombre: 'Mililitro',       simbolo: 'ml',   tipo: 'VOLUMEN' },
  { id: 'm',     nombre: 'Metro',           simbolo: 'm',    tipo: 'LONGITUD' },
  { id: 'cm',    nombre: 'Centímetro',      simbolo: 'cm',   tipo: 'LONGITUD' },
  { id: 'mm',    nombre: 'Milímetro',       simbolo: 'mm',   tipo: 'LONGITUD' },
  { id: 'm2',    nombre: 'Metro cuadrado',  simbolo: 'm²',   tipo: 'AREA' },
  { id: 'm3',    nombre: 'Metro cúbico',    simbolo: 'm³',   tipo: 'VOLUMEN' },
  { id: 'ml_lin',nombre: 'Metro lineal',    simbolo: 'ml',   tipo: 'LONGITUD' },
  { id: 'und',   nombre: 'Unidad',          simbolo: 'und',  tipo: 'CONTEO' },
  { id: 'pza',   nombre: 'Pieza',           simbolo: 'pza',  tipo: 'CONTEO' },
  { id: 'par',   nombre: 'Par',             simbolo: 'par',  tipo: 'CONTEO' },
  { id: 'rollo', nombre: 'Rollo',           simbolo: 'rollo',tipo: 'CONTEO' },
  { id: 'lam',   nombre: 'Lámina',          simbolo: 'lam',  tipo: 'CONTEO' },
  { id: 'barra', nombre: 'Barra',           simbolo: 'barra',tipo: 'CONTEO' },
  { id: 'tubo',  nombre: 'Tubo',            simbolo: 'tubo', tipo: 'CONTEO' },
  { id: 'gal',   nombre: 'Galón',           simbolo: 'gal',  tipo: 'VOLUMEN' },
];

const CATEGORIAS_MATERIAL = [
  { id: 'aceros',      nombre: 'Aceros y metales',      descripcion: 'Planchas, tubos, perfiles, barras de acero y otros metales' },
  { id: 'insumos',     nombre: 'Insumos de producción', descripcion: 'Electrodos, discos de corte, brocas, consumibles varios' },
  { id: 'pintura',     nombre: 'Pinturas y recubrimientos', descripcion: 'Pintura anticorrosiva, esmalte, galvanizado en frío' },
  { id: 'electricidad',nombre: 'Materiales eléctricos', descripcion: 'Cable, conduit, cajas, tableros para luminarias' },
  { id: 'tornilleria', nombre: 'Tornillería y fijaciones', descripcion: 'Tornillos, tuercas, pernos, arandelas' },
  { id: 'herramienta', nombre: 'Herramientas y equipos', descripcion: 'Herramientas manuales, equipos de medición, EPP' },
  { id: 'madera',      nombre: 'Madera y aglomerados',  descripcion: 'Tableros, madera para lockers y mobiliario' },
  { id: 'vidrio',      nombre: 'Vidrio y acrílicos',    descripcion: 'Vidrio templado, policarbonato, acrílico' },
  { id: 'quimicos',    nombre: 'Químicos y solventes',  descripcion: 'Thinner, acetona, desengrasante, fluxante' },
  { id: 'embalaje',    nombre: 'Embalaje y empaque',    descripcion: 'Cinta, stretch film, cartón, espuma' },
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Iniciando seed de Firestore...\n');

  console.log('📐 Unidades de medida:');
  for (const u of UNIDADES_MEDIDA) {
    const { id, ...data } = u;
    await upsert('unidades_medida', id, data);
  }

  console.log('\n📦 Categorías de material:');
  for (const c of CATEGORIAS_MATERIAL) {
    const { id, ...data } = c;
    await upsert('categorias', id, data);
  }

  console.log('\n✅ Seed completado.');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Error en seed:', err);
  process.exit(1);
});
