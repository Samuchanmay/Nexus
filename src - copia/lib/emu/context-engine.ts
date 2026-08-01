// ══════════════════════════════════════════════════════════
//  EMU · Context Engine — junta en un solo objeto lo que hoy vive
//  disperso (rol/permisos en nav.ts, jornada en hours.ts, cola de
//  aprobación en `requests`) para que las reglas nunca hagan su
//  propia query. Reusa la MISMA lógica de jornada que ya usa
//  JornadaWatcher (summarizeDay/scheduleFor) — nunca reinventa el
//  cronómetro, solo lo consulta.
// ══════════════════════════════════════════════════════════
import type { SupabaseClient } from "@supabase/supabase-js";
import { summarizeDay, scheduleFor } from "../hours";
import type { JornadaState } from "../hours";
import type { AttendanceRow, Schedule } from "../types";
import { todayMerida } from "../tz";
import type { EmuContext } from "./types";

/** Roles que fichan — igual que el comentario de JornadaWatcher ("los
 *  únicos roles que fichan"). Si esto cambia allá, cambia aquí también. */
const ROLES_CON_JORNADA = new Set(["admin", "empleado"]);

/** Roles con bandeja de solicitudes REAL hoy. nav.ts declara también
 *  "coordinador" y "departamento", pero app-shell.tsx (HREF) no tiene
 *  todavía una ruta para ellos — EMU solo debe ofrecer una acción que de
 *  verdad lleve a algún lado, nunca un botón que aterrice en 404. */
const ROLES_CON_SOLICITUDES = new Set(["admin"]);

export async function gatherEmuContext(
  supabase: SupabaseClient, userId: string, role: string,
): Promise<EmuContext> {
  const today = todayMerida();
  const wantsJornada = ROLES_CON_JORNADA.has(role);
  const wantsRequests = ROLES_CON_SOLICITUDES.has(role);

  const [attRes, schedRes, statesRes, reqRes] = await Promise.all([
    wantsJornada
      ? supabase.from("attendance").select("*").eq("user_id", userId).eq("date", today)
      : Promise.resolve({ data: null }),
    wantsJornada
      ? supabase.from("schedules").select("*").eq("user_id", userId)
      : Promise.resolve({ data: null }),
    wantsJornada
      ? supabase.from("jornada_states").select("*").eq("activo", true)
      : Promise.resolve({ data: null }),
    wantsRequests
      ? supabase.from("requests").select("id", { count: "exact", head: true }).eq("status", "solicitada")
      : Promise.resolve({ count: null as number | null }),
  ]);

  let jornada: EmuContext["jornada"] = null;
  if (wantsJornada) {
    const schedule = scheduleFor((schedRes.data ?? []) as Schedule[], userId, today)
      ?? { target_min: 480, tolerance_min: 15, end_time: "18:00:00" };
    const day = summarizeDay(today, (attRes.data ?? []) as AttendanceRow[], schedule, (statesRes.data ?? []) as JornadaState[]);
    jornada = { isOpen: day.isOpen, hasWorkedToday: !!day.firstIn, metTarget: day.totalMin >= day.targetMin };
  }

  return {
    userId, role, today, jornada,
    pendingRequestsCount: wantsRequests ? ((reqRes as { count: number | null }).count ?? 0) : null,
  };
}
