// ══════════════════════════════════════════════════════════════════
//  EMET · ReportEngine — Reporte 1: Asistencia (el más importante)
//  ══════════════════════════════════════════════════════════════════
//  Reutiliza el mismo resolver de estado (getAttendanceStatus) y el
//  mismo motor de horas (summarizeDay) que ya usan Asistencia/Directorio/
//  Hoy — este archivo NO reimplementa esas reglas, solo las llama para
//  cada día del rango pedido. Ver docs/audits/report-system-audit.md.
//
//  Decisión resuelta con el usuario (7 ago 2026): "NO se miden retardos"
//  es una regla de negocio deliberada de lib/hours.ts — este reporte NO
//  incluye estado ni columna "Retardo"/"Retardos". Solo se muestran los
//  estados reales que ya produce el resolver.
//
//  Fines de semana: se excluyen del desglose diario (mismo criterio que
//  el reporte semanal legado en admin/asistencia/page.tsx — un sábado sin
//  fichaje NO es una falta, así que no tiene caso listarlo como fila).
// ══════════════════════════════════════════════════════════════════
import type { SupabaseClient } from "@supabase/supabase-js";
import { scheduleFor, summarizeDay, type JornadaState } from "@/lib/hours";
import type { AttendanceRow, Schedule } from "@/lib/types";
import { getAttendanceStatus, type IncidentKind } from "@/lib/domain/attendance/status";
import { daysInRange } from "@/lib/calendar-core";
import { isoWeekday, todayMerida } from "@/lib/tz";
import type { DateRange, ReportColumn } from "./types";

export interface AttendanceReportRow {
  userId: string;
  employeeName: string;
  departmentName: string;
  date: string;
  entrada: string | null;       // "HH:MM:SS" o null
  salidaComida: string | null;
  regresoComida: string | null;
  salidaFinal: string | null;
  horasTrabajadas: number | null;
  horasExtra: number | null;
  /** Estado real del día — nunca "Sin fichar" cuando hay un motivo real
      (Vacaciones, Incapacidad, etc.). Vacío solo cuando de verdad no pasó
      nada explicable (sin_iniciar/fuera_horario, ver showInReports). */
  estadoDelDia: string;
}

/** Ajusta el reportLabel del resolver a una etiqueta más natural para este
 *  reporte — NO cambia la lógica de decisión, solo el texto de un par de
 *  estados cuyo reportLabel interno (pensado para el Excel semanal viejo,
 *  todo en mayúsculas) no es el que el usuario pidió ver aquí. */
function displayStatusLabel(key: string, fallbackLabel: string): string {
  if (key === "jornada_terminada") return "Asistencia completa";
  return fallbackLabel;
}

export interface AttendanceReportFilters {
  range: DateRange;
  employeeId?: string | null;
  departmentId?: string | null;
  /** Filtra por estado ya resuelto (ej. solo "Vacaciones") — se aplica
      DESPUÉS de calcular el estado real, nunca antes (no puede ocultar
      un estado real, solo elegir cuáles mostrar). */
  status?: string | null;
}

/** Trae y calcula todas las filas de Asistencia para el rango pedido.
 *  `supabase` puede ser el cliente de servidor o el de cliente — la
 *  función es agnóstica, así el mismo motor sirve para el server action
 *  del módulo Reportes y, a futuro, para el envío automático por correo. */
export async function fetchAttendanceReportRows(
  supabase: SupabaseClient,
  filters: AttendanceReportFilters,
): Promise<AttendanceReportRow[]> {
  const { range } = filters;
  const today = todayMerida();

  let teamQuery = supabase
    .from("users")
    .select("id, display_name, area, area_id, departments(id, nombre)")
    .eq("active", true)
    .in("role", ["admin", "empleado"]);
  if (filters.employeeId) teamQuery = teamQuery.eq("id", filters.employeeId);
  if (filters.departmentId) teamQuery = teamQuery.eq("area_id", filters.departmentId);

  const [{ data: team }, { data: att }, { data: scheds }, { data: jornadaStates },
    { data: vacs }, { data: incs }, { data: holidayRows }, { data: restDayRows }] = await Promise.all([
    teamQuery,
    supabase.from("attendance").select("*").gte("date", range.from).lte("date", range.to).order("date").order("time"),
    supabase.from("schedules").select("*"),
    supabase.from("jornada_states").select("*").eq("activo", true),
    supabase.from("vacations").select("user_id, start_date, end_date").eq("status", "Aprobada").is("archived_at", null).gte("end_date", range.from),
    supabase.from("incidents").select("user_id, kind, note, start_date, end_date").eq("status", "Autorizado").is("archived_at", null).gte("end_date", range.from),
    supabase.from("holidays").select("date").gte("date", range.from).lte("date", range.to),
    supabase.from("rest_days").select("user_id, note, start_date, end_date").gte("end_date", range.from),
  ]);

  const states = (jornadaStates ?? []) as JornadaState[];
  const allSchedules = (scheds ?? []) as Schedule[];
  const rows = (att ?? []) as AttendanceRow[];
  const holidaySet = new Set((holidayRows ?? []).map((h) => h.date as string));

  function byUser<T extends { user_id: string }>(arr: T[] | null): Map<string, T[]> {
    const m = new Map<string, T[]>();
    for (const r of arr ?? []) m.set(r.user_id, [...(m.get(r.user_id) ?? []), r]);
    return m;
  }
  const vacsByUser = byUser(vacs as { user_id: string; start_date: string; end_date: string }[] | null);
  const incsByUser = byUser(incs as { user_id: string; kind: string; note: string | null; start_date: string; end_date: string }[] | null);
  const restDaysByUser = byUser(restDayRows as { user_id: string; note: string | null; start_date: string; end_date: string }[] | null);

  const dates = daysInRange(range.from, range.to).filter((d) => {
    const dow = isoWeekday(d);
    return dow !== 0 && dow !== 6; // excluye sáb/dom — ver comentario de cabecera.
  });

  type TeamRow = { id: string; display_name: string; area: string | null; area_id: string | null; departments: { id: string; nombre: string } | { id: string; nombre: string }[] | null };
  const out: AttendanceReportRow[] = [];

  for (const u of (team ?? []) as TeamRow[]) {
    const dept = Array.isArray(u.departments) ? u.departments[0] : u.departments;
    const departmentName = dept?.nombre ?? u.area ?? "—";
    const myRows = rows.filter((r) => r.user_id === u.id);

    for (const date of dates) {
      const sched = scheduleFor(allSchedules, u.id, date) ?? { target_min: 480, tolerance_min: 15, end_time: "18:00:00" };
      const day = summarizeDay(date, myRows, sched, states);

      const vac = (vacsByUser.get(u.id) ?? []).find((v) => v.start_date <= date && v.end_date >= date);
      const inc = (incsByUser.get(u.id) ?? []).find((i) => i.start_date <= date && i.end_date >= date);
      const rd = (restDaysByUser.get(u.id) ?? []).find((r) => r.start_date <= date && r.end_date >= date);

      const status = getAttendanceStatus({
        date, today, firstIn: day.firstIn, isOpen: day.isOpen, noRegistroSalida: day.noRegistroSalida,
        vacation: vac ? { start: vac.start_date, end: vac.end_date } : null,
        incident: inc ? { kind: inc.kind as IncidentKind, note: inc.note } : null,
        isHoliday: holidaySet.has(date), restDay: rd ? { note: rd.note } : null,
        isBusinessDay: true, // ya filtramos sáb/dom arriba
      });

      const dayMv = myRows.filter((r) => r.date === date).sort((a, b) => a.time.localeCompare(b.time));
      const salidaComida = dayMv.find((m) => m.reason === "Salida a comer")?.time ?? null;
      const regresoComida = dayMv.find((m) => m.reason === "Regreso de comida")?.time ?? null;

      out.push({
        userId: u.id,
        employeeName: u.display_name,
        departmentName,
        date,
        entrada: day.firstIn,
        salidaComida,
        regresoComida,
        salidaFinal: day.isOpen ? null : day.lastOut,
        horasTrabajadas: day.totalMin > 0 ? Math.round((day.totalMin / 60) * 100) / 100 : null,
        horasExtra: day.extraMin > 0 ? Math.round((day.extraMin / 60) * 100) / 100 : null,
        estadoDelDia: status.showInReports ? displayStatusLabel(status.key, status.label) : "",
      });
    }
  }

  const filtered = filters.status
    ? out.filter((r) => r.estadoDelDia === filters.status)
    : out;

  return filtered.sort((a, b) => a.employeeName.localeCompare(b.employeeName) || a.date.localeCompare(b.date));
}

export const ATTENDANCE_COLUMNS: ReportColumn<AttendanceReportRow>[] = [
  { header: "Nombre del empleado", width: 26, align: "left", get: (r) => r.employeeName },
  { header: "Departamento", width: 20, align: "left", get: (r) => r.departmentName },
  { header: "Fecha", width: 12, format: "date", get: (r) => r.date },
  { header: "Hora de entrada", width: 14, format: "time12h", get: (r) => r.entrada },
  { header: "Salida a comida", width: 14, format: "time12h", get: (r) => r.salidaComida },
  { header: "Regreso de comida", width: 15, format: "time12h", get: (r) => r.regresoComida },
  { header: "Hora de salida", width: 14, format: "time12h", get: (r) => r.salidaFinal },
  { header: "Horas trabajadas", width: 14, format: "hours", get: (r) => r.horasTrabajadas },
  { header: "Horas extra", width: 12, format: "hours", get: (r) => r.horasExtra },
  {
    header: "Estado del día", width: 20, get: (r) => r.estadoDelDia || "—",
    tint: (r) => ATTENDANCE_STATUS_COLORS[r.estadoDelDia],
  },
];

/** Mismo criterio semántico que STATUS_COLORS de xlsx-report.tsx, pero
 *  ahora vive junto a las columnas del reporte que las usa (motor único,
 *  no un archivo de colores separado que alguien más tenga que sincronizar). */
const ATTENDANCE_STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  "Asistencia completa": { bg: "D1FAE5", fg: "065F46" },
  "Vacaciones": { bg: "E9D5FF", fg: "6B21A8" },
  "Incapacidad": { bg: "FEE2E2", fg: "991B1B" },
  "Permiso": { bg: "FEF3C7", fg: "92400E" },
  "Comisión": { bg: "DBEAFE", fg: "1E40AF" },
  "Home office": { bg: "DBEAFE", fg: "1E40AF" },
  "Falta justificada": { bg: "FEF3C7", fg: "92400E" },
  "Falta injustificada": { bg: "FEE2E2", fg: "991B1B" },
  "Día inhábil": { bg: "F1F5F9", fg: "475569" },
  "Descanso": { bg: "F1F5F9", fg: "475569" },
  "Evento externo": { bg: "DBEAFE", fg: "1E40AF" },
  "No registró salida": { bg: "FEE2E2", fg: "991B1B" },
  "Pendiente de confirmar salida": { bg: "FEF3C7", fg: "92400E" },
};

/** Opciones para el filtro "Estado del día" de la landing — misma fuente
 *  que el tint del Excel, para que el filtro y el color nunca se
 *  desincronicen. */
export const ATTENDANCE_REPORT_STATUS_OPTIONS = Object.keys(ATTENDANCE_STATUS_COLORS)
  .map((label) => ({ value: label, label }));
