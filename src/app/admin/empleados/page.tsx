import { createClient } from "@/lib/supabase/server";
import EmpleadosClient from "./client";
import type { UserProfile, Department } from "@/lib/types";
import { todayMerida } from "@/lib/tz";

export default async function Empleados() {
  const supabase = await createClient();
  const today = todayMerida();
  const [{ data }, { data: areas }, { data: rhColorRow }, { data: vacs }, { data: incs }] = await Promise.all([
    supabase.from("users").select("*").order("created_at"),
    supabase.from("departments").select("*").eq("activo", true).order("tipo").order("nombre"),
    supabase.from("app_settings").select("value").eq("key", "rh_color").maybeSingle(),
    // Vacaciones aprobadas vigentes HOY — para el punto de estado junto al avatar.
    supabase.from("vacations").select("user_id").eq("status", "Aprobada").is("archived_at", null)
      .lte("start_date", today).gte("end_date", today),
    // Incidencias (permiso/incapacidad/etc.) ya autorizadas y vigentes HOY.
    supabase.from("incidents").select("user_id").eq("status", "Autorizado")
      .lte("start_date", today).gte("end_date", today),
  ]);
  return (
    <EmpleadosClient
      users={(data ?? []) as UserProfile[]}
      areas={(areas ?? []) as Department[]}
      rhColor={rhColorRow?.value ?? null}
      vacationTodayIds={(vacs ?? []).map((v) => v.user_id as string)}
      permisoTodayIds={(incs ?? []).map((i) => i.user_id as string)}
    />
  );
}
