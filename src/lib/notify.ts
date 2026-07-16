// NEXUS · Helpers para generar notificaciones reales (campana).
// Llaman a funciones de Postgres con SECURITY DEFINER porque un usuario
// normal no tiene permiso de RLS para insertar notificaciones de OTRA
// persona (por diseño) — sin esto, la campana nunca recibe nada real.
import type { SupabaseClient } from "@supabase/supabase-js";

/** Notifica a una persona específica. Nunca debe bloquear la acción real si falla. */
export async function notifyUser(
  supabase: SupabaseClient, userId: string, title: string, body?: string, kind: string = "info",
) {
  try {
    await supabase.rpc("create_notification", { p_user_id: userId, p_title: title, p_body: body ?? null, p_kind: kind });
  } catch { /* no bloquea la acción principal */ }
}

/** Notifica a todos los administradores activos. */
export async function notifyAdmins(
  supabase: SupabaseClient, title: string, body?: string, kind: string = "info",
) {
  try {
    await supabase.rpc("notify_admins", { p_title: title, p_body: body ?? null, p_kind: kind });
  } catch { /* no bloquea la acción principal */ }
}
