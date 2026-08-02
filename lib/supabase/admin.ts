/**
 * lib/supabase/admin.ts — cliente con la service_role key.
 *
 * Server-only. BYPASSRLS — nunca importar en componentes/archivos de cliente
 * Server-only. Bypasea RLS — nunca importar en componentes de cliente.
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
  // Next.js parchea el `fetch` global y puede cachear las llamadas internas de
  // supabase-js (el cliente se crea una sola vez a nivel de módulo, no por request) —
  // sin esto, una API route con `force-dynamic` puede seguir sirviendo lecturas viejas.
  global: {
    fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
  },
});
