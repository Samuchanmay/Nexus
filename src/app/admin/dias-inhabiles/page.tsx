import { createClient } from "@/lib/supabase/server";
import DiasClient from "./client";
import { todayMerida } from "@/lib/tz";

export default async function DiasInhabiles() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const today = todayMerida();
  const [{ data }, { data: meRow }, { data: team }, { data: restDays }] = await Promise.all([
    supabase.from("holidays").select("*").order("date"),
    user ? supabase.from("users").select("id").eq("auth_id", user.id).single() : Promise.resolve({ data: null }),
    supabase.from("users").select("id, display_name").eq("active", true).in("role", ["admin", "empleado"]).order("display_name"),
    // Task 6 — Descanso asignado por admin (rest_days, distinto de vacaciones/
    // incidencias: nadie lo solicita, solo admin lo da de alta). Se muestran
    // los vigentes o por venir; los ya vencidos no aportan nada aquí.
    supabase.from("rest_days")
      .select("id, user_id, start_date, end_date, note, users:user_id(display_name)")
      .gte("end_date", today).order("start_date"),
  ]);
  type RestDayRow = { id: string; user_id: string; start_date: string; end_date: string; note: string | null; users: { display_name: string } | null };
  return (
    <DiasClient
      holidays={(data ?? []) as { id: string; date: string; name: string; kind: string }[]}
      adminId={meRow?.id ?? ""}
      team={(team ?? []) as { id: string; display_name: string }[]}
      restDays={((restDays ?? []) as unknown as RestDayRow[]).map((r) => ({
        id: r.id, userId: r.user_id, userName: r.users?.display_name ?? "—",
        startDate: r.start_date, endDate: r.end_date, note: r.note,
      }))}
    />
  );
}
