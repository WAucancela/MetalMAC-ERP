/**
 * lib/supabase/admin.ts — cliente con la service_role key.
 *
 * Server-only. BYPASSRLS — nunca importar en componentes/archivos de cliente
 * (equivalente a lib/firebase-admin.ts en la versión Firebase).
 */
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase.types';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    'Faltan variables de entorno: NEXT_PUBLIC_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY',
  );
}

export const supabaseAdmin = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
