/**
 * scripts/create-admin.ts — Asigna rol GERENTE al primer usuario.
 *
 * Uso:
 *   npx tsx scripts/create-admin.ts usuario@metalmac.com
 *
 * Roles disponibles: GERENTE | BODEGUERO | PRODUCCION | CONTABILIDAD
 *   npx tsx scripts/create-admin.ts usuario@metalmac.com BODEGUERO
 *
 * Requiere las variables FIREBASE_ADMIN_* en .env.local
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_ADMIN_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
      privateKey:  process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const ROLES_VALIDOS = ['GERENTE', 'BODEGUERO', 'PRODUCCION', 'CONTABILIDAD'] as const;
type Rol = typeof ROLES_VALIDOS[number];

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
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().setCustomUserClaims(user.uid, { rol });

    console.log(`\n✅ Custom claim asignado:`);
    console.log(`   Email : ${email}`);
    console.log(`   UID   : ${user.uid}`);
    console.log(`   Rol   : ${rol}`);
    console.log(`\n⚠️  El usuario debe cerrar sesión y volver a entrar para que el`);
    console.log(`   nuevo rol tome efecto en el token JWT.\n`);
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'auth/user-not-found') {
      console.error(`❌ No se encontró ningún usuario con el email: ${email}`);
      console.error('   Crea el usuario primero en Firebase Console → Authentication.');
    } else {
      console.error('❌ Error:', err);
    }
    process.exit(1);
  }

  process.exit(0);
}

main();
