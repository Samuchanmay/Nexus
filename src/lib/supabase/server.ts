import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder",
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options));
          } catch { /* Server Component — middleware refresca la sesión */ }
        },
      },
    },
  );
}

/**
 * auth.getUser() dedupeado por request (React cache): si el layout y la
 * page de una misma ruta lo llaman por separado (caso normal en rutas con
 * layout propio, ej. /chat), sin esto cada uno dispara su propia llamada a
 * Supabase Auth — y si el access token ya expiró, ambas intentan refrescar
 * el MISMO refresh token a la vez. Una gana y lo rota; la otra llega tarde
 * y Supabase la rechaza con "Refresh Token Already Used"/"Not Found" — un
 * error real que veíamos en producción y que el middleware podía confundir
 * con "sesión inválida". cache() colapsa todas las llamadas de la misma
 * petición en una sola, eliminando la carrera de raíz (no es una única
 * página o layout — cualquier ruta con esta forma se beneficia).
 */
export const getAuthedUser = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
});
