import { createClient } from "@/lib/supabase/server";
import { summarizeDay, scheduleFor } from "@/lib/hours";
import type { JornadaState } from "@/lib/hours";
import type { AttendanceRow, Schedule } from "@/lib/types";
import { todayMerida, addDays } from "@/lib/tz";
import AsistenciaClient, { type PersonDay, type WeekRow, type PendingValidation } from "./client";
import type { WeekBlock, DayDetail } from "./xlsx-weekly-report";
import { getAttendanceStatus, type IncidentKind } from "@/lib/domain/attendance/status";

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

/** Desglose de un día para el Excel: entrada, salida a comer, regreso, salida
    final, y motivo de ausencia (statusLabel) cuando no hubo entrada — el
    `absenceReasonFor` opcional es la única pieza que no puede vivir en este
    helper de nivel módulo (necesita los lookups históricos del componente). */
function buildDayDetail(
  date: string, rows: AttendanceRow[],
  sched: Pick<Schedule, "target_min" | "tolerance_min" | "end_time">, states: JornadaState[],
  absenceReasonFor?: (date: string) => string | undefined,
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
    statusLabel: entrada ? undefined : absenceReasonFor?.(date),
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

  const [{ data: team }, { data: att }, { data: scheds }, { data: jornadaStates }, { data: weekAtt }, { data: settingsRows }, { data: vacs }, meRes, { data: pendingExits }, { data: incs }, { data: holidayRows }, { data: restDayRows }, { data: vacsHist }, { data: incsHist }, { data: holidaysHist }, { data: restDaysHist }] = await Promise.all([
    supabase.from("users").select("id, display_name, full_name, nexus_color, area, title, avatar_url, birth_date").eq("active", true).in("role", ["admin", "empleado"]),
    supabase.from("attendance").select("*").eq("date", today).order("time"),
    supabase.from("schedules").select("*"),
    supabase.from("jornada_states").select("*").eq("activo", true),
    supabase.from("attendance").select("*").gte("date", since).order("date").order("time"),
    supabase.from("app_settings").select("key, value").in("key", ["weekly_report_enabled", "weekly_report_email"]),
    // Aprobadas, vigentes hoy o por iniciar en los próximos días — misma
    // fuente que "Vacaciones" en Hoy admin, para que el punto de estado y
    // la tarjeta de Asistencia coincidan con la realidad (Plano Maestro §10).
    supabase.from("vacations").select("user_id, start_date, end_date")
      .eq("status", "Aprobada").is("archived_at", null).gte("end_date", today),
    user ? supabase.from("users").select("id").eq("auth_id", user.id).single() : Promise.resolve({ data: null }),
    // Salidas olvidadas que la propia persona ya no puede confirmar y pidió
    // validación manual — antes era un flujo exclusivo de RH sin pantalla
    // real; ahora Administrador también lo resuelve desde Asistencia
    // (FASE R). Trae el nombre para no cruzar contra `team` (team ya viene
    // filtrado a active=true, pero una salida pendiente puede ser de
    // cualquier persona con jornada, activa o no).
    supabase.from("pending_exits")
      .select("id, user_id, date, resolved_reason, users:user_id(display_name, avatar_url, nexus_color)")
      .eq("status", "pendiente").eq("requested_rh_validation", true)
      .order("date", { ascending: true }),
    // Incidencias/feriados/descansos vigentes HOY — mismo patrón que Task 3
    // (admin/empleados), para que el Attendance Status Resolver tenga la
    // misma información en Asistencia que en Directorio (spec 2026-07-31).
    supabase.from("incidents").select("user_id, kind, note, start_date, end_date").eq("status", "Autorizado")
      .is("archived_at", null).lte("start_date", today).gte("end_date", today),
    supabase.from("holidays").select("date").eq("date", today),
    supabase.from("rest_days").select("user_id, note, start_date, end_date").lte("start_date", today).gte("end_date", today),
    // Mismas 4 fuentes pero abiertas a las 8 semanas de `since` — el punto
    // de estado de arriba solo necesita HOY, pero el reporte semanal/Excel
    // (Task 5) necesita el motivo de cada día pasado sin entrada, no solo
    // el de hoy.
    supabase.from("vacations").select("user_id, start_date, end_date")
      .eq("status", "Aprobada").is("archived_at", null).gte("end_date", since),
    supabase.from("incidents").select("user_id, kind, note, start_date, end_date").eq("status", "Autorizado")
      .is("archived_at", null).gte("end_date", since),
    supabase.from("holidays").select("date").gte("date", since),
    supabase.from("rest_days").select("user_id, note, start_date, end_date").gte("end_date", since),
  ]);
  // "Próximo" = arranca en los próximos 3 días (mismo umbral que "Saldo
  // bajo" en Vacaciones admin) — ventana corta, solo lo inminente.
  const PROXIMO_DIAS = 3;
  const daysUntil = (d: string) => Math.round((new Date(d + "T12:00:00Z").getTime() - new Date(today + "T12:00:00Z").getTime()) / 86400000);
  const vacationOf = new Map((vacs ?? []).map((v) => {
    const today_ = v.start_date <= today && v.end_date >= today;
    const until = daysUntil(v.start_date);
    return [v.user_id, {
      today: today_, soonDays: !today_ && until >= 0 && until <= PROXIMO_DIAS ? until : null,
      startDate: v.start_date, endDate: v.end_date,
    }];
  }));
  const isHoliday = (holidayRows ?? []).length > 0;
  const incidentOf = new Map((incs ?? []).map((i) => [i.user_id as string, { kind: i.kind as string, note: i.note as string | null }]));
  const restDayOf = new Map((restDayRows ?? []).map((r) => [r.user_id as string, { note: r.note as string | null }]));

  // ── Lookups históricos (8 semanas) para el motivo de ausencia del Excel/
  // reporte semanal (Task 5) — un usuario puede tener varias vacaciones/
  // incidencias/descansos en la ventana, por eso son arreglos por usuario
  // (no un Map de 1 solo valor como los "de hoy" de arriba).
  function byUser<T extends { user_id: string }>(rows: T[] | null): Map<string, T[]> {
    const m = new Map<string, T[]>();
    for (const r of rows ?? []) m.set(r.user_id, [...(m.get(r.user_id) ?? []), r]);
    return m;
  }
  const vacsByUser = byUser(vacsHist as { user_id: string; start_date: string; end_date: string }[] | null);
  const incsByUser = byUser(incsHist as { user_id: string; kind: string; note: string | null; start_date: string; end_date: string }[] | null);
  const restDaysByUser = byUser(restDaysHist as { user_id: string; note: string | null; start_date: string; end_date: string }[] | null);
  const holidaySet = new Set((holidaysHist ?? []).map((h) => h.date as string));

  /** Motivo de ausencia (Vacaciones/Incapacidad/…/Día inhábil/Descanso) para
      un usuario en una fecha sin entrada — mismo resolver que Directorio/
      Asistencia (Tasks 3-4), aplicado ahora también al histórico del reporte
      semanal/Excel. */
  const absenceReasonFor = (userId: string, date: string): string | undefined => {
    const vac = (vacsByUser.get(userId) ?? []).find((v) => v.start_date <= date && v.end_date >= date);
    const inc = (incsByUser.get(userId) ?? []).find((i) => i.start_date <= date && i.end_date >= date);
    const rd = (restDaysByUser.get(userId) ?? []).find((r) => r.start_date <= date && r.end_date >= date);
    const wd = new Date(date + "T12:00:00Z").getUTCDay();
    const s = getAttendanceStatus({
      date, today, firstIn: null, isOpen: false, noRegistroSalida: false,
      vacation: vac ? { start: vac.start_date, end: vac.end_date } : null,
      incident: inc ? { kind: inc.kind as IncidentKind, note: inc.note } : null,
      isHoliday: holidaySet.has(date), restDay: rd ? { note: rd.note } : null,
      isBusinessDay: wd !== 0, // el bloque semanal ya solo itera Lunes..Sábado
    });
    // Solo interesa el motivo cuando de verdad explica la ausencia —
    // showInReports ya excluye "sin iniciar"/"fuera de horario" (no son un
    // motivo), dejando la columna vacía para esos casos.
    return s.showInReports ? s.label : undefined;
  };
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
    const day = summarizeDay(today, rows.filter((r) => r.user_id === u.id), sched ?? { target_min: 480, tolerance_min: 15, end_time: "18:00:00" }, states);
    return {
      user: {
        id: u.id, display_name: u.display_name, area: u.area, title: u.title,
        nexus_color: u.nexus_color, avatar_url: u.avatar_url, birth_date: u.birth_date,
        vacation: vacationOf.get(u.id) ?? { today: false, soonDays: null, startDate: null, endDate: null },
        incident: incidentOf.get(u.id) ?? null,
        restDay: restDayOf.get(u.id) ?? null,
      },
      schedule,
      day: {
        firstIn: day.firstIn, lastOut: day.lastOut, totalMin: day.totalMin,
        targetMin: day.targetMin, metTarget: day.metTarget, isOpen: day.isOpen,
        noRegistroSalida: day.noRegistroSalida,
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
      const daySched = scheduleFor((scheds ?? []) as Schedule[], u.id, d) ?? { target_min: 480, tolerance_min: 15, end_time: "18:00:00" };
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
        const daySched = scheduleFor((scheds ?? []) as Schedule[], u.id, date) ?? { target_min: 480, tolerance_min: 15, end_time: "18:00:00" };
        days.push(buildDayDetail(date, myRows, daySched, states, (d) => absenceReasonFor(u.id, d)));
      }
      weekBlocks.push({ userId: u.id, name: u.display_name, color: u.nexus_color ?? "#5856D6", weekStart: wk, weekLabel: weekLabelOf(wk), days });
    }
  }
  weekBlocks.sort((a, b) => b.weekStart.localeCompare(a.weekStart) || a.name.localeCompare(b.name));

  type PendingExitRow = {
    id: string; user_id: string; date: string; resolved_reason: string | null;
    users: { display_name: string; avatar_url: string | null; nexus_color: string | null } | null;
  };
  const pendingValidations: PendingValidation[] = ((pendingExits ?? []) as unknown as PendingExitRow[]).map((p) => ({
    id: p.id, userId: p.user_id, date: p.date, note: p.resolved_reason,
    userName: p.users?.display_name ?? "—", avatarUrl: p.users?.avatar_url ?? null, color: p.users?.nexus_color ?? null,
  }));

  return (
    <AsistenciaClient
      people={people} states={states} weekRows={weekRows} weekBlocks={weekBlocks}
      reportSettings={reportSettings} today={today} adminId={meRes?.data?.id ?? ""}
      pendingValidations={pendingValidations} isHoliday={isHoliday}
    />
  );
}
