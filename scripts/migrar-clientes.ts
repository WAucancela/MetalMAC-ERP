/**
 * scripts/migrar-clientes.ts — Backfill de la tabla `clientes` a partir de
 * los datos que hoy viven como texto libre y desconectado en `facturas_venta`
 * (cliente_nombre + cliente_ruc), `cotizaciones` (cliente_nombre + email),
 * `pedidos_woocommerce` (cliente_nombre + email) y `proyectos` (solo
 * `cliente`, un campo de texto sin email ni RUC).
 *
 * Estrategia de deduplicación — "automático conservador": solo fusiona
 * cuando hay una coincidencia de alta confianza; si no, crea un cliente
 * nuevo en vez de arriesgarse a mezclar dos clientes distintos.
 *
 *   1. facturas_venta primero — tiene el dato más confiable (RUC real).
 *      Agrupa por `cliente_ruc` exacto.
 *   2. cotizaciones y pedidos_woocommerce — sin RUC, pero con email. Busca
 *      un cliente ya creado por email exacto (case-insensitive); si no,
 *      por nombre exacto (trim + case-insensitive); si no, crea uno nuevo
 *      con `identificacion = null`.
 *   3. proyectos al final — la señal más débil (solo nombre, sin email).
 *      Se procesa último para tener la mejor chance de encontrar ya creado
 *      el cliente correspondiente desde una fuente más confiable.
 *
 * No hay fuzzy-matching de nombres a propósito (ninguna tolerancia a typos):
 * es preferible dejar un duplicado ("Constructora XYZ" vs "Constructora XYZ
 * S.A." como dos registros separados) a fusionar por error dos clientes
 * reales distintos. Los duplicados que queden se pueden fusionar a mano
 * después — no hay pérdida de datos, cada fila sigue enlazada a su cliente.
 *
 * Uso:
 *   npx tsx scripts/migrar-clientes.ts           # aplica los cambios
 *   npx tsx scripts/migrar-clientes.ts --dry-run  # solo imprime qué haría
 *
 * Requiere NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local.
 * Idempotente: correrlo de nuevo no duplica — cualquier fila que ya tenga
 * `cliente_id` se omite.
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase.types';

const DRY_RUN = process.argv.includes('--dry-run');

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const norm = (s: string) => s.trim().toLowerCase();

interface ClienteCache {
  id: string;
  razonSocial: string;
  email: string;
  identificacion: string | null;
}

const porIdentificacion = new Map<string, ClienteCache>();
const porEmail = new Map<string, ClienteCache>();
const porNombre = new Map<string, ClienteCache>();

function registrarEnCache(c: ClienteCache) {
  if (c.identificacion) porIdentificacion.set(c.identificacion, c);
  if (c.email) porEmail.set(norm(c.email), c);
  porNombre.set(norm(c.razonSocial), c);
}

async function cargarClientesExistentes() {
  const { data, error } = await supabase.from('clientes').select('id, razon_social, email, identificacion');
  if (error) throw error;
  for (const row of data ?? []) {
    registrarEnCache({ id: row.id, razonSocial: row.razon_social, email: row.email, identificacion: row.identificacion });
  }
}

async function crearCliente(input: {
  razonSocial: string;
  email?: string;
  identificacion?: string | null;
  tipoIdentificacion?: 'RUC' | 'CEDULA' | null;
}): Promise<ClienteCache> {
  const razonSocial = input.razonSocial.trim();
  const email = (input.email ?? '').trim();
  const identificacion = input.identificacion?.trim() || null;

  if (DRY_RUN) {
    const fake: ClienteCache = { id: `dry-run-${porNombre.size}`, razonSocial, email, identificacion };
    registrarEnCache(fake);
    return fake;
  }

  const { data, error } = await supabase
    .from('clientes')
    .insert({
      razon_social: razonSocial,
      email,
      identificacion,
      tipo_identificacion: input.tipoIdentificacion ?? null,
    })
    .select('id, razon_social, email, identificacion')
    .single();
  if (error) throw error;

  const c: ClienteCache = { id: data.id, razonSocial: data.razon_social, email: data.email, identificacion: data.identificacion };
  registrarEnCache(c);
  return c;
}

/** Busca un cliente ya creado por identificación, luego email, luego nombre exacto. */
function buscarClienteExistente(opts: { identificacion?: string | null; email?: string; nombre: string }): ClienteCache | undefined {
  if (opts.identificacion && porIdentificacion.has(opts.identificacion)) {
    return porIdentificacion.get(opts.identificacion);
  }
  if (opts.email && porEmail.has(norm(opts.email))) {
    return porEmail.get(norm(opts.email));
  }
  return porNombre.get(norm(opts.nombre));
}

async function enlazar(tabla: 'cotizaciones' | 'proyectos' | 'facturas_venta' | 'pedidos_woocommerce', id: string, clienteId: string) {
  if (DRY_RUN) return;
  const { error } = await supabase.from(tabla).update({ cliente_id: clienteId }).eq('id', id);
  if (error) throw error;
}

// ── 1. facturas_venta — agrupa por RUC exacto (la señal más fuerte) ────────

async function migrarFacturasVenta() {
  console.log('\n📄 facturas_venta (por RUC):');
  const { data, error } = await supabase
    .from('facturas_venta')
    .select('id, cliente_nombre, cliente_ruc, cliente_email')
    .is('cliente_id', null);
  if (error) throw error;

  let creados = 0, enlazados = 0;
  for (const row of data ?? []) {
    const ruc = row.cliente_ruc?.trim() || null;
    let cliente = ruc ? porIdentificacion.get(ruc) : undefined;
    if (!cliente) {
      cliente = await crearCliente({
        razonSocial: row.cliente_nombre,
        email: row.cliente_email ?? '',
        identificacion: ruc,
        tipoIdentificacion: ruc ? (ruc.length === 13 ? 'RUC' : 'CEDULA') : null,
      });
      creados++;
    }
    await enlazar('facturas_venta', row.id, cliente.id);
    enlazados++;
  }
  console.log(`  ${enlazados} facturas enlazadas, ${creados} clientes nuevos`);
}

// ── 2. cotizaciones — por email, luego nombre ───────────────────────────────

async function migrarCotizaciones() {
  console.log('\n📋 cotizaciones (por email / nombre):');
  const { data, error } = await supabase
    .from('cotizaciones')
    .select('id, cliente_nombre, cliente_email')
    .is('cliente_id', null);
  if (error) throw error;

  let creados = 0, enlazados = 0;
  for (const row of data ?? []) {
    let cliente = buscarClienteExistente({ email: row.cliente_email, nombre: row.cliente_nombre });
    if (!cliente) {
      cliente = await crearCliente({ razonSocial: row.cliente_nombre, email: row.cliente_email ?? '' });
      creados++;
    }
    await enlazar('cotizaciones', row.id, cliente.id);
    enlazados++;
  }
  console.log(`  ${enlazados} cotizaciones enlazadas, ${creados} clientes nuevos`);
}

// ── 3. pedidos_woocommerce — por email, luego nombre ────────────────────────

async function migrarPedidosWooCommerce() {
  console.log('\n🛒 pedidos_woocommerce (por email / nombre):');
  const { data, error } = await supabase
    .from('pedidos_woocommerce')
    .select('id, cliente_nombre, cliente_email')
    .is('cliente_id', null);
  if (error) throw error;

  let creados = 0, enlazados = 0;
  for (const row of data ?? []) {
    if (!row.cliente_nombre?.trim()) continue; // pedido sin datos de cliente resuelto todavía
    let cliente = buscarClienteExistente({ email: row.cliente_email, nombre: row.cliente_nombre });
    if (!cliente) {
      cliente = await crearCliente({ razonSocial: row.cliente_nombre, email: row.cliente_email ?? '' });
      creados++;
    }
    await enlazar('pedidos_woocommerce', row.id, cliente.id);
    enlazados++;
  }
  console.log(`  ${enlazados} pedidos enlazados, ${creados} clientes nuevos`);
}

// ── 4. proyectos — solo nombre (la señal más débil, se procesa último) ─────

async function migrarProyectos() {
  console.log('\n📁 proyectos (por nombre exacto — sin email/RUC disponible):');
  const { data, error } = await supabase
    .from('proyectos')
    .select('id, cliente')
    .is('cliente_id', null);
  if (error) throw error;

  let creados = 0, enlazados = 0;
  for (const row of data ?? []) {
    let cliente = porNombre.get(norm(row.cliente));
    if (!cliente) {
      cliente = await crearCliente({ razonSocial: row.cliente });
      creados++;
    }
    await enlazar('proyectos', row.id, cliente.id);
    enlazados++;
  }
  console.log(`  ${enlazados} proyectos enlazados, ${creados} clientes nuevos`);
}

async function main() {
  console.log(`🔗 Backfill de clientes${DRY_RUN ? ' (DRY RUN — no se escribe nada)' : ''}\n`);

  await cargarClientesExistentes();
  console.log(`Clientes ya existentes en caché: ${porNombre.size}`);

  await migrarFacturasVenta();
  await migrarCotizaciones();
  await migrarPedidosWooCommerce();
  await migrarProyectos();

  console.log(`\n✅ Listo. Total de clientes en el sistema: ${porNombre.size}`);
  if (DRY_RUN) console.log('   (dry-run: no se escribió nada — correr sin --dry-run para aplicar)');
}

main().catch((err) => {
  console.error('❌ Error en la migración de clientes:', err);
  process.exit(1);
});
