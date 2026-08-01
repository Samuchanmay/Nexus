import { createClient } from "@supabase/supabase-js";

/** Cliente con la llave de servicio (service role). Solo se usa en el
    backend (rutas API), nunca en componentes. Bypass de RLS. */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder",
  );
}
