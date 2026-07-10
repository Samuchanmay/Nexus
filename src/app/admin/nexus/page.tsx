import { createClient } from "@/lib/supabase/server";
import { summarizeDay } from "@/lib/hours";
import type { JornadaState } from "@/lib/hours";
import type { AttendanceRow, Schedule } from "@/lib/types";
import { todayMerida, addDays } from "@/lib/tz";
import AsistenciaClient, { type PersonDay, type WeekRow } from "./client";

/** Lunes de la semana ISO que contiene la fecha dada (YYYY-MM-DD, sin efectos de zona). */
function mondayOf(dateIso: string): string {
  const d = new Date(dateIso + "T12:00:00Z");
  const day = d.getUTCDay(); // 0=Dom..6=Sáb
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

/** Asistencia — server junta los datos; la vista (tabla ⇄ Gantt ⇄ semana) vive en client.tsx */
export default async function AsistenciaEquipo() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const today = todayMerida();
  const since = addDays(today, -56); // 8 semanas

  const [{ data: team }, { data: att }, { data: scheds }, { data: jornadaStates }, { data: weekAtt }, { data: settingsRows }, meRes] = await Promise.all([
    supabase.from("users").select("id, display_name, full_name, nexus_color, area").eq("active", true).in("role", ["admin", "empleado"]),
    supabase.from("attendance").select("*").eq("date", today).order("time"),
    supabase.from("schedules").select("*").is("valid_until", null),
    supabase.from("jornada_states").select("*").eq("activo", true),
    supabase.from("attendance").select("*").gte("date", since).order("date").order("time"),
    supabase.from("app_settings").select("key, value").in("key", ["weekly_report_enabled", "weekly_report_email"]),
    user ? supabase.from("users").select("id").eq("auth_id", user.id).single() : Promise.resolve({ data: null }),
  ]);
  const states = (jornadaStates ?? []) as JornadaState[];
  const settingsMap = new Map((settingsRows ?? []).map((s) => [s.key, s.value as string]));
  const reportSettings = {
    enabled: settingsMap.get("weekly_report_enabled") !== "false",
    email: settingsMap.get("weekly_report_email") ?? "",
  };

  const rows = (att ?? []) as AttendanceRow[];
  const people: PersonDay[] = (team ?? []).map((u) => {
    const sched = (scheds ?? []).find((s) => s.user_id === u.id) as Schedule | undefined;
    const schedule = {
      start_time: sched?.start_time ?? "09:00:00",
      end_time: sched?.end_time ?? "18:00:00",
      target_min: sched?.target_min ?? 480,
    };
    const day = summarizeDay(today, rows.filter((r) => r.user_id === u.id), sched ?? { target_min: 480, tolerance_min: 15 }, states);
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

  // Desglose semanal por persona (equivalente al reporte semanal del checador legado)
  const weekRows: WeekRow[] = [];
  const weekAttRows = (weekAtt ?? []) as AttendanceRow[];
  for (const u of (team ?? [])) {
    const sched = (scheds ?? []).find((s) => s.user_id === u.id) as Schedule | undefined;
    const mySched = sched ?? { target_min: 480, tolerance_min: 15 };
    const myRows = weekAttRows.filter((r) => r.user_id === u.id);
    const dates = [...new Set(myRows.map((r) => r.date))];
    const byWeek = new Map<string, { totalMin: number; extraMin: number; days: number }>();
    for (const d of dates) {
      const day = summarizeDay(d, myRows, mySched, states);
      const wk = mondayOf(d);
      const acc = byWeek.get(wk) ?? { totalMin: 0, extraMin: 0, days: 0 };
      acc.totalMin += day.totalMin;
      acc.extraMin += day.extraMin;
      if (day.totalMin > 0) acc.days += 1;
      byWeek.set(wk, acc);
    }
    for (const [week, acc] of byWeek) {
      weekRows.push({ userId: u.id, name: u.display_name, week, ...acc });
    }
  }
  weekRows.sort((a, b) => b.week.localeCompare(a.week) || a.name.localeCompare(b.name));

  return <AsistenciaClient people={people} states={states} weekRows={weekRows} reportSettings={reportSettings} today={today} adminId={meRes?.data?.id ?? ""} />;
}
