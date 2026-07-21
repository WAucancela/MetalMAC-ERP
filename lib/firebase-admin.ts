/**
 * Firebase Admin SDK — SOLO para uso en /app/api/ routes (server-side).
 * Nunca importar en componentes del cliente o en lib/firebase.ts.
 *
 * Usa FIREBASE_ADMIN_* variables (sin NEXT_PUBLIC_).
 */
import {
  initializeApp as initAdminApp,
  getApps as getAdminApps,
  cert,
  App,
} from 'firebase-admin/app';
import { getFirestore as getAdminFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth as getAdminAuth, Auth } from 'firebase-admin/auth';
import { getStorage as getAdminStorage, Storage } from 'firebase-admin/storage';

function createAdminApp(): App {
  if (getAdminApps().length > 0) return getAdminApps()[0];

  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (
    !process.env.FIREBASE_ADMIN_PROJECT_ID ||
    !process.env.FIREBASE_ADMIN_CLIENT_EMAIL ||
    !privateKey
  ) {
    throw new Error(
      'Variables de entorno Firebase Admin no configuradas. ' +
      'Revisa FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY.',
    );
  }

  return initAdminApp({
    credential: cert({
      projectId:   process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey,
    }),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

const adminApp = createAdminApp();

export const adminDb: Firestore  = getAdminFirestore(adminApp);
export const adminAuth: Auth     = getAdminAuth(adminApp);
export const adminStorage: Storage = getAdminStorage(adminApp);
