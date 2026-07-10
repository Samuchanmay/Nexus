/**
 * lib/admin-log.ts — Bitácora de productividad del admin.
 *
 * Cuando el admin aprueba una solicitud, revisa vacaciones, exporta un
 * reporte, etc., eso también es su trabajo — y debe reflejarse en su propio
 * "Mi día" (nota del Plano Maestro: el admin también mide su productividad,
 * aunque cubra eventos, diseñe o edite video en vez de solo administrar).
 *
 * Fire-and-forget a propósito: si el log falla, nunca debe bloquear ni
 * revertir la acción real que se está registrando.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export function logAdminAction(
  supabase: SupabaseClient,
  userId: string,
  action: string,
  detail?: string,
): void {
  void supabase.from("admin_activity_log").insert({ user_id: userId, action, detail: detail ?? null }).then();
}
