import { createClient } from "@/lib/supabase/server";
import EmpleadosClient from "./client";
import type { UserProfile, Department } from "@/lib/types";
import { todayMerida } from "@/lib/tz";

export default async function Empleados() {
  const supabase = await createClient();
  const today = todayMerida();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data }, { data: areas }, { data: rhColorRow }, { data: vacs }, { data: incs }, { data: holidayRows }, { data: restDayRows }, { data: meRow }] = await Promise.all([
    supabase.from("users").select("*").order("created_at"),
    supabase.from("departments").select("*").eq("activo", true).order("tipo").order("nombre"),
    supabase.from("app_settings").select("value").eq("key", "rh_color").maybeSingle(),
    // Vacaciones aprobadas vigentes HOY — para el punto de estado junto al avatar.
    supabase.from("vacations").select("user_id, start_date, end_date").eq("status", "Aprobada").is("archived_at", null)
      .lte("start_date", today).gte("end_date", today),
    // Incidencias (permiso/incapacidad/etc.) ya autorizadas y vigentes HOY — se
    // conserva start_date/end_date (no solo end_date) para no confundir una
    // incidencia futura con una que de verdad cubre hoy (Attendance Status
    // Resolver, spec 2026-07-31).
    supabase.from("incidents").select("user_id, kind, note, start_date, end_date").eq("status", "Autorizado")
      .is("archived_at", null).lte("start_date", today).gte("end_date", today),
    supabase.from("holidays").select("date").eq("date", today),
    supabase.from("rest_days").select("user_id, note, start_date, end_date").lte("start_date", today).gte("end_date", today),
    user ? supabase.from("users").select("id").eq("auth_id", user.id).single() : Promise.resolve({ data: null }),
  ]);

  const isHoliday = (holidayRows ?? []).length > 0;
  const vacationOf = new Map((vacs ?? []).map((v) => [v.user_id as string, { start: v.start_date as string, end: v.end_date as string }]));
  const incidentOf = new Map((incs ?? []).map((i) => [i.user_id as string, { kind: i.kind as string, note: i.note as string | null }]));
  const restDayOf = new Map((restDayRows ?? []).map((r) => [r.user_id as string, { note: r.note as string | null }]));

  return (
    <EmpleadosClient
      users={(data ?? []) as UserProfile[]}
      areas={(areas ?? []) as Department[]}
      rhColor={rhColorRow?.value ?? null}
      vacationOf={Object.fromEntries(vacationOf)}
      incidentOf={Object.fromEntries(incidentOf)}
      restDayOf={Object.fromEntries(restDayOf)}
      isHoliday={isHoliday}
      adminId={meRow?.id ?? ""}
    />
  );
}
