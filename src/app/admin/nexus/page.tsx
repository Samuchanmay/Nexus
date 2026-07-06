import { createClient } from "@/lib/supabase/server";
import { summarizeDay } from "@/lib/hours";
import type { AttendanceRow, Schedule } from "@/lib/types";
import { todayMerida } from "@/lib/tz";
import AsistenciaClient, { type PersonDay } from "./client";

/** Asistencia — server junta los datos; la vista (tabla ⇄ Gantt L2) vive en client.tsx */
export default async function AsistenciaEquipo() {
  const supabase = await createClient();
  const today = todayMerida();
  const [{ data: team }, { data: att }, { data: scheds }] = await Promise.all([
    supabase.from("users").select("id, display_name, full_name, nexus_color, area").eq("active", true).in("role", ["admin", "empleado"]),
    supabase.from("attendance").select("*").eq("date", today).order("time"),
    supabase.from("schedules").select("*").is("valid_until", null),
  ]);

  const rows = (att ?? []) as AttendanceRow[];
  const people: PersonDay[] = (team ?? []).map((u) => {
    const sched = (scheds ?? []).find((s) => s.user_id === u.id) as Schedule | undefined;
    const schedule = {
      start_time: sched?.start_time ?? "09:00:00",
      end_time: sched?.end_time ?? "18:00:00",
      target_min: sched?.target_min ?? 480,
    };
    const day = summarizeDay(today, rows.filter((r) => r.user_id === u.id), sched ?? { target_min: 480, tolerance_min: 15 });
    return {
      user: { id: u.id, display_name: u.display_name, area: u.area, nexus_color: u.nexus_color },
      schedule,
      day: {
        firstIn: day.firstIn, lastOut: day.lastOut, totalMin: day.totalMin,
        targetMin: day.targetMin, metTarget: day.metTarget, isOpen: day.isOpen,
        movements: day.movements.map((m) => ({ id: m.id, type: m.type, reason: m.reason, time: m.time })),
      },
    };
  });

  return <AsistenciaClient people={people} />;
}
