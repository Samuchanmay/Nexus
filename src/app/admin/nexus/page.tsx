import { createClient } from "@/lib/supabase/server";
import { summarizeDay, scheduleFor } from "@/lib/hours";
import type { JornadaState } from "@/lib/hours";
import type { AttendanceRow, Schedule } from "@/lib/types";
import { todayMerida, addDays } from "@/lib/tz";
import AsistenciaClient, { type PersonDay, type WeekRow } from "./client";
import type { WeekBlock, DayDetail } from "./xlsx-weekly-report";

const DIAS_LARGO = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MESES_LARGO = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** "09:26 AM" — formato de hora usado en el Excel descargable (distinto del 12h "a.m./p.m." de la UI). */
function fmtExcelTime(t: string | null): string | null {
  if (!t) return null;
  const [hStr, mStr] = t.slice(0, 5).split(":");
  let h = Number(hStr);
  const suffix = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${String(h).padStart(2, "0")}:${mStr} ${suffix}`;
}

/** "29 junio al 04 de julio" (o "29 de junio al 04 de julio" si cruza de mes). */
function weekLabelOf(monday: string): string {
  const start = new Date(monday + "T12:00:00Z");
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 5); // sábado
  const d1 = start.getUTCDate(), m1 = MESES_LARGO[start.getUTCMonth()];
  const d2 = end.getUTCDate(), m2 = MESES_LARGO[end.getUTCMonth()];
  return m1 === m2 ? `${d1} al ${d2} de ${m1}` : `${d1} de ${m1} al ${d2} de ${m2}`;
}

/** Desglose de un día para el Excel: entrada, salida a comer, regreso, salida final. */
function buildDayDetail(
  date: string, rows: AttendanceRow[],
  sched: Pick<Schedule, "target_min" | "tolerance_min">, states: JornadaState[],
): DayDetail {
  const mv = rows.filter((r) => r.date === date).sort((a, b) => a.time.localeCompare(b.time));
  const entradas = mv.filter((m) => m.type === "Entrada");
  const salidas = mv.filter((m) => m.type === "Salida");
  const entrada = entradas[0]?.time ?? null;
  const finJornada = salidas.find((s) => s.reason === "Fin de jornada");
  const salida1Row = salidas.find((s) => s.reason !== "Fin de jornada");
  const salida1 = salida1Row?.time ?? null;
  let entrada2: string | null = null;
  if (salida1Row) {
    const idx = mv.findIndex((m) => m === salida1Row);
    entrada2 = mv.slice(idx + 1).find((m) => m.type === "Entrada")?.time ?? null;
  }
  const salidaFinal = finJornada?.time ?? (salidas.length ? salidas[salidas.length - 1].time : null);
  const summary = entrada ? summarizeDay(date, rows, sched, states) : null;
  const wd = new Date(date + "T12:00:00Z").getUTCDay();
  return {
    dayLabel: DIAS_LARGO[wd], date,
    entrada: fmtExcelTime(entrada), salida1: fmtExcelTime(salida1),
    entrada2: fmtExcelTime(entrada2), salidaFinal: fmtExcelTime(salidaFinal),
    horasTrabajadas: summary && summary.totalMin > 0 ? Math.round((summary.totalMin / 60) * 10) / 10 : null,
    horasExtra: summary && summary.extraMin > 0 ? Math.round((summary.extraMin / 60) * 10) / 10 : null,
  };
}

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
    supabase.from("users").select("id, display_name, full_name, nexus_color, area, avatar_url, birth_date").eq("active", true).in("role", ["admin", "empleado"]),
    supabase.from("attendance").select("*").eq("date", today).order("time"),
    supabase.from("schedules").select("*"),
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
    const sched = scheduleFor((scheds ?? []) as Schedule[], u.id, today);
    const schedule = {
      start_time: sched?.start_time ?? "09:00:00",
      end_time: sched?.end_time ?? "18:00:00",
      target_min: sched?.target_min ?? 480,
    };
    const day = summarizeDay(today, rows.filter((r) => r.user_id === u.id), sched ?? { target_min: 480, tolerance_min: 15 }, states);
    return {
      user: { id: u.id, display_name: u.display_name, area: u.area, nexus_color: u.nexus_color, avatar_url: u.avatar_url, birth_date: u.birth_date },
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
    const myRows = weekAttRows.filter((r) => r.user_id === u.id);
    const dates = [...new Set(myRows.map((r) => r.date))];
    const byWeek = new Map<string, { totalMin: number; extraMin: number; days: number }>();
    for (const d of dates) {
      const daySched = scheduleFor((scheds ?? []) as Schedule[], u.id, d) ?? { target_min: 480, tolerance_min: 15 };
      const day = summarizeDay(d, myRows, daySched, states);
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

  // ── Bloques por empleado/semana para el reporte Excel descargable (últimas 6 semanas con actividad) ──
  const weekBlocks: WeekBlock[] = [];
  for (const u of (team ?? [])) {
    const myRows = weekAttRows.filter((r) => r.user_id === u.id);
    const mondays = [...new Set(myRows.map((r) => mondayOf(r.date)))].sort().reverse().slice(0, 6);
    for (const wk of mondays) {
      const days: DayDetail[] = [];
      for (let i = 0; i < 6; i++) { // Lunes..Sábado
        const date = addDays(wk, i);
        const daySched = scheduleFor((scheds ?? []) as Schedule[], u.id, date) ?? { target_min: 480, tolerance_min: 15 };
        days.push(buildDayDetail(date, myRows, daySched, states));
      }
      weekBlocks.push({ userId: u.id, name: u.display_name, color: u.nexus_color ?? "#5856D6", weekStart: wk, weekLabel: weekLabelOf(wk), days });
    }
  }
  weekBlocks.sort((a, b) => b.weekStart.localeCompare(a.weekStart) || a.name.localeCompare(b.name));

  return (
    <AsistenciaClient
      people={people} states={states} weekRows={weekRows} weekBlocks={weekBlocks}
      reportSettings={reportSettings} today={today} adminId={meRes?.data?.id ?? ""}
    />
  );
}
