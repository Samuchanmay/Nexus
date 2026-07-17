"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Antes createClient() creaba una instancia nueva de Supabase cada vez que
 * se llamaba (y se llama en ~20 archivos, varias veces por componente).
 * Eso rompía las notificaciones en vivo (Realtime): el canal de
 * postgres_changes necesita el token de sesión ya cargado para poder pasar
 * el RLS de "notifications" (nt_own: user_id = my_user_id()); con una
 * instancia nueva por cada llamada, la sesión de esa instancia efímera no
 * siempre alcanzaba a hidratarse antes del .subscribe(), así que el canal
 * quedaba autenticado como anon → RLS bloqueaba el evento → nunca llegaba
 * en vivo, solo al recargar (que sí usa el fetch normal con cookies).
 *
 * Fix: una sola instancia compartida (singleton) para todo el navegador,
 * como recomienda la documentación de Supabase para apps con Realtime.
 */
let browserClient: SupabaseClient | undefined;

export function createClient() {
  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder",
    );
  }
  return browserClient;
}
