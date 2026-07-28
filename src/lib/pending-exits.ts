// ══════════════════════════════════════════════════════════
//  NEXUS · Validación de salidas pendientes
//  Un día PASADO que quedó abierto (entrada registrada, nunca hubo
//  salida) NUNCA se etiqueta directamente como "No registró salida":
//  queda registrado aquí como 'pendiente' hasta que la propia persona
//  confirme su hora real de salida ('resuelta') o RH/Admin determine
//  que de verdad no hay forma de recuperarla ('no_registro'). Ver
//  hours.ts (DaySummary.noRegistroSalida) para el detalle crudo que
//  alimenta esto.
// ══════════════════════════════════════════════════════════
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DaySummary } from "./hours";

export type PendingExitStatus = "pendiente" | "resuelta" | "no_registro";

export interface PendingExit {
  id: string;
  userId: string;
  date: string;
  status: PendingExitStatus;
  requestedRhValidation: boolean;
  resolvedTime: string | null;
  resolvedReason: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
}

type PendingExitRow = {
  id: string; user_id: string; date: string; status: string;
  requested_rh_validation: boolean; resolved_time: string | null;
  resolved_reason: string | null; resolved_by: string | null; resolved_at: string | null;
};

function mapRow(r: PendingExitRow): PendingExit {
  return {
    id: r.id, userId: r.user_id, date: r.date, status: r.status as PendingExitStatus,
    requestedRhValidation: r.requested_rh_validation,
    resolvedTime: r.resolved_time, resolvedReason: r.resolved_reason,
    resolvedBy: r.resolved_by, resolvedAt: r.resolved_at,
  };
}

/**
 * Da de alta (si no existía) un registro `pending_exits` para cada día
 * PASADO que quedó abierto. NUNCA pisa un registro ya existente
 * (ignoreDuplicates) — si ya se resolvió o RH ya lo marcó como
 * definitivo, sincronizar de nuevo no debe revertirlo a 'pendiente'.
 */
export async function syncPendingExits(
  supabase: SupabaseClient, userId: string, days: Pick<DaySummary, "date" | "noRegistroSalida">[],
): Promise<void> {
  const toSync = days.filter((d) => d.noRegistroSalida);
  if (toSync.length === 0) return;
  await supabase.from("pending_exits").upsert(
    toSync.map((d) => ({ user_id: userId, date: d.date, status: "pendiente" as const })),
    { onConflict: "user_id,date", ignoreDuplicates: true },
  );
}

/** Mapa fecha → registro pending_exits, para una persona y un conjunto de fechas. */
export async function getPendingExitsMap(
  supabase: SupabaseClient, userId: string, dates: string[],
): Promise<Map<string, PendingExit>> {
  if (dates.length === 0) return new Map();
  const { data } = await supabase.from("pending_exits").select("*").eq("user_id", userId).in("date", dates);
  return new Map(((data ?? []) as PendingExitRow[]).map((r) => [r.date, mapRow(r)]));
}

/** El día PASADO abierto más antiguo aún sin resolver (para el diálogo del día siguiente). */
export async function getOldestPendingExit(supabase: SupabaseClient, userId: string): Promise<PendingExit | null> {
  const { data } = await supabase
    .from("pending_exits").select("*")
    .eq("user_id", userId).eq("status", "pendiente")
    .order("date", { ascending: true }).limit(1).maybeSingle();
  return data ? mapRow(data as PendingExitRow) : null;
}

/**
 * Cómo debe verse un día con noRegistroSalida=true en la UI: mientras RH no
 * lo haya confirmado como definitivo, se ve como "Pendiente de confirmar
 * salida" (advertencia) — solo escala a "No registró salida" real cuando
 * RH/Admin lo marcó explícitamente así.
 */
export function exitPillFor(pe: PendingExit | undefined): { label: string; tone: "warn" | "danger" } {
  if (pe?.status === "no_registro") return { label: "No registró salida", tone: "danger" };
  return { label: "Pendiente de confirmar salida", tone: "warn" };
}

/**
 * La persona confirma su hora real de salida: inserta el movimiento
 * "Fin de jornada" (backdated, mismo camino de datos que /fichar pero sin
 * GPS — RLS att_insert_own ya lo permite para la propia persona) y marca
 * el pending_exit como 'resuelta'.
 */
export async function resolvePendingExit(
  supabase: SupabaseClient, userId: string, date: string, time: string, reason: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error: attErr } = await supabase.from("attendance").insert({
    user_id: userId, type: "Salida", reason: "Fin de jornada", date, time,
    lat: null, lng: null, distance_m: null, device_id: "jornada-pendiente-resuelta",
  });
  if (attErr) return { ok: false, error: attErr.message };
  const { error: peErr } = await supabase.from("pending_exits")
    .update({ status: "resuelta", resolved_time: time, resolved_reason: reason || null, resolved_at: new Date().toISOString() })
    .eq("user_id", userId).eq("date", date).eq("status", "pendiente");
  if (peErr) return { ok: false, error: peErr.message };
  return { ok: true };
}

/** La persona no recuerda su hora exacta: pide que un Administrador (antes
    era flujo exclusivo de RH sin pantalla real — FASE R) lo valide manualmente. */
export async function requestRhValidation(
  supabase: SupabaseClient, userId: string, date: string, note: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from("pending_exits")
    .update({ requested_rh_validation: true, resolved_reason: note || null })
    .eq("user_id", userId).eq("date", date).eq("status", "pendiente");
  if (error) return { ok: false, error: error.message };
  // Aviso a Administrador — antes esta solicitud quedaba muda en la tabla,
  // sin ninguna pantalla que la mostrara. notify_admins ya existe en la BD
  // (0006_notification_link.sql), solo faltaba llamarlo desde aquí.
  await supabase.rpc("notify_admins", {
    p_title: "Salida pendiente de validar",
    p_body: `Alguien del equipo pidió confirmar manualmente su salida del ${date}.`,
    p_kind: "incident",
    p_link: "/admin/nexus",
  });
  return { ok: true };
}

/**
 * Administrador confirma la hora real de salida en nombre de la persona
 * (mismo camino de datos que resolvePendingExit, pero disparado desde el
 * panel de Asistencia) y le notifica que ya quedó resuelto.
 */
export async function adminResolvePendingExit(
  supabase: SupabaseClient, userId: string, date: string, time: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error: attErr } = await supabase.from("attendance").insert({
    user_id: userId, type: "Salida", reason: "Fin de jornada", date, time,
    lat: null, lng: null, distance_m: null, device_id: "jornada-pendiente-resuelta-admin",
  });
  if (attErr) return { ok: false, error: attErr.message };
  const { error: peErr } = await supabase.from("pending_exits")
    .update({ status: "resuelta", resolved_time: time, resolved_at: new Date().toISOString() })
    .eq("user_id", userId).eq("date", date).eq("status", "pendiente");
  if (peErr) return { ok: false, error: peErr.message };
  await supabase.rpc("create_notification", {
    p_user_id: userId,
    p_title: "Tu salida pendiente quedó confirmada",
    p_body: `Un administrador confirmó tu salida del ${date} a las ${time.slice(0, 5)}.`,
    p_kind: "info",
    p_link: null,
  });
  return { ok: true };
}

/** Administrador determina que de verdad no hay forma de recuperar la hora — cierra el caso como definitivo. */
export async function adminMarkNoRegistro(
  supabase: SupabaseClient, userId: string, date: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from("pending_exits")
    .update({ status: "no_registro", resolved_at: new Date().toISOString() })
    .eq("user_id", userId).eq("date", date).eq("status", "pendiente");
  if (error) return { ok: false, error: error.message };
  await supabase.rpc("create_notification", {
    p_user_id: userId,
    p_title: "Tu salida del " + date + " quedó marcada como no registrada",
    p_body: "Un administrador cerró el caso porque no fue posible confirmar la hora real de salida.",
    p_kind: "incident",
    p_link: null,
  });
  return { ok: true };
}
