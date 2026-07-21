/**
 * scripts/create-admin.ts — Asigna rol GERENTE al primer usuario.
 *
 * Uso:
 *   npx tsx scripts/create-admin.ts usuario@metalmac.com
 *
 * Roles disponibles: GERENTE | BODEGUERO | PRODUCCION | CONTABILIDAD
 *   npx tsx scripts/create-admin.ts usuario@metalmac.com BODEGUERO
 *
 * Requiere las variables NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const ROLES_VALIDOS = ['GERENTE', 'BODEGUERO', 'PRODUCCION', 'CONTABILIDAD'] as const;
type Rol = typeof ROLES_VALIDOS[number];

async function buscarUsuarioPorEmail(email: string) {
  // El Admin API de Supabase no expone un getUserByEmail directo; se pagina
  // listUsers() y se filtra en memoria (aceptable para un ERP de un solo taller).
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const found = data.users.find((u) => u.email === email);
    if (found) return found;
    if (data.users.length < perPage) return null;
    page += 1;
  }
}

async function main() {
  const email = process.argv[2];
  const rol   = (process.argv[3] ?? 'GERENTE').toUpperCase() as Rol;

  if (!email) {
    console.error('❌ Uso: npx tsx scripts/create-admin.ts EMAIL [ROL]');
    console.error('   Roles: GERENTE | BODEGUERO | PRODUCCION | CONTABILIDAD');
    process.exit(1);
  }

  if (!ROLES_VALIDOS.includes(rol)) {
    console.error(`❌ Rol inválido: "${rol}". Usa: ${ROLES_VALIDOS.join(' | ')}`);
    process.exit(1);
  }

  try {
    const user = await buscarUsuarioPorEmail(email);
    if (!user) {
      console.error(`❌ No se encontró ningún usuario con el email: ${email}`);
      console.error('   Crea el usuario primero en Supabase Studio → Authentication.');
      process.exit(1);
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      app_metadata: { rol },
    });
    if (updateError) throw updateError;

    // Espejo humano-legible en `perfiles` — se mantiene en sincro con app_metadata
    // en la misma corrida (ver plan de migración, sección "Auth-side profile table").
    const { error: upsertError } = await supabase
      .from('perfiles')
      .upsert({ id: user.id, email, rol });
    if (upsertError) throw upsertError;

    console.log(`\n✅ Rol asignado:`);
    console.log(`   Email : ${email}`);
    console.log(`   UID   : ${user.id}`);
    console.log(`   Rol   : ${rol}`);
    console.log(`\n⚠️  El usuario debe cerrar sesión y volver a entrar para que el`);
    console.log(`   nuevo rol tome efecto en el token JWT.\n`);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

main();
