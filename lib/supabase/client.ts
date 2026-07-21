/**
 * lib/supabase/client.ts — cliente de navegador (browser).
 *
 * Usa @supabase/ssr para que la sesión se persista en cookies automáticamente
 * (reemplaza el hack manual de `document.cookie` que tenía hooks/useAuth.ts con
 * Firebase). NUNCA importar `lib/supabase/admin.ts` desde archivos de cliente.
 */
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
