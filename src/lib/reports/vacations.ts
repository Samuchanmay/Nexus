// ══════════════════════════════════════════════════════════════════
//  EMET · ReportEngine — Reporte 2: Vacaciones
//  ══════════════════════════════════════════════════════════════════
//  Una fila = una solicitud de vacaciones, con el contexto del empleado
//  repetido en cada fila (mismo criterio que Asistencia con Departamento)
//  — así el "Historial de vacaciones" que pide el spec ES la tabla
//  completa (todas las solicitudes de esa persona, sin recortar), no una
//  segunda vista separada que pudiera desincronizarse.
//
//  "Quién autorizó" (resolved_by/resolved_at) requirió migración 0051 —
//  ver ese archivo para el porqué (la tabla no lo guardaba antes). Filas
//  de solicitudes resueltas ANTES de esa migración muestran "—" ahí: es
//  un dato real que no existe, no se inventa un responsable retroactivo.
// ══════════════════════════════════════════════════════════════════
import type { SupabaseClient } from "@supabase/supabase-js";
import { dmy, nextAnniversary } from "@/lib/tz";
import type { DateRange, ReportColumn } from "./types";

export interface VacationReportRow {
  userId: string;
  employeeName: string;
  departmentName: string;
  diasOtorgados: number;
  diasUtilizados: number;
  diasDisponibles: number;
  fechaIngreso: string | null;
  reinicioVacaciones: string | null;   // próxima fecha de reinicio (aniversario)
  periodoVacacional: string;           // label "DD/MM/AAAA – DD/MM/AAAA"
  fechaSolicitud: string;              // created_at
  fechaAutorizacion: string | null;    // resolved_at
  fechaInicio: string;
  fechaFin: string;
  totalDiasTomados: number;
  estatus: string;
  autorizadoPor: string | null;
}

export interface VacationReportFilters {
  range: DateRange;
  employeeId?: string | null;
  departmentId?: string | null;
  status?: string | null;
  /** Filtro rápido por año calendario — si viene, MANDA sobre `range`
      (conveniencia pedida en el spec: "Periodo" además del rango fino). */
  year?: number | null;
}

export interface VacationSummary {
  tomadasEsteAnio: number;
  proximosReinicios: number;
  saldoBajo: number; // empleados con <5 días disponibles
}

export async function fetchVacationReportRows(
  supabase: SupabaseClient,
  filters: VacationReportFilters,
): Promise<{ rows: VacationReportRow[]; summary: VacationSummary }> {
  const effRange: DateRange = filters.year
    ? { from: `${filters.year}-01-01`, to: `${filters.year}-12-31` }
    : filters.range;

  let teamQuery = supabase
    .from("users")
    .select("id, display_name, area, area_id, hire_date, vacation_balance, vacation_days_per_year, departments(id, nombre)")
    .eq("active", true).in("role", ["admin", "empleado"]);
  if (filters.employeeId) teamQuery = teamQuery.eq("id", filters.employeeId);
  if (filters.departmentId) teamQuery = teamQuery.eq("area_id", filters.departmentId);

  let vacQuery = supabase
    .from("vacations")
    .select("id, user_id, start_date, end_date, days, status, admin_note, created_at, resolved_at, resolved_by, resolved_user:resolved_by(display_name)")
    .is("archived_at", null)
    .lte("start_date", effRange.to).gte("end_date", effRange.from);
  if (filters.employeeId) vacQuery = vacQuery.eq("user_id", filters.employeeId);
  if (filters.status) vacQuery = vacQuery.eq("status", filters.status);

  const [{ data: team }, { data: vacs }, { data: resets }] = await Promise.all([
    teamQuery,
    vacQuery,
    supabase.from("vacation_resets").select("user_id, reset_at").order("reset_at", { ascending: false }),
  ]);

  type TeamRow = {
    id: string; display_name: string; area: string | null; area_id: string | null; hire_date: string | null;
    vacation_balance: number; vacation_days_per_year: number;
    departments: { id: string; nombre: string } | { id: string; nombre: string }[] | null;
  };
  type VacRow = {
    id: string; user_id: string; start_date: string; end_date: string; days: number; status: string;
    admin_note: string | null; created_at: string; resolved_at: string | null; resolved_by: string | null;
    resolved_user: { display_name: string } | { display_name: string }[] | null;
  };

  const teamById = new Map(((team ?? []) as TeamRow[]).map((t) => [t.id, t]));
  const lastResetByUser = new Map<string, string>();
  for (const r of (resets ?? []) as { user_id: string; reset_at: string }[]) {
    if (!lastResetByUser.has(r.user_id)) lastResetByUser.set(r.user_id, r.reset_at);
  }

  const departmentFilterOk = (t: TeamRow) => !filters.departmentId || t.area_id === filters.departmentId;

  const rows: VacationReportRow[] = ((vacs ?? []) as VacRow[])
    .map((v) => {
      const t = teamById.get(v.user_id);
      if (!t || !departmentFilterOk(t)) return null;
      const dept = Array.isArray(t.departments) ? t.departments[0] : t.departments;
      const resolver = Array.isArray(v.resolved_user) ? v.resolved_user[0] : v.resolved_user;
      const lastReset = lastResetByUser.get(v.user_id) ?? null;
      const nextReset = t.hire_date ? nextAnniversary(t.hire_date) : null;
      return {
        userId: v.user_id,
        employeeName: t.display_name,
        departmentName: dept?.nombre ?? t.area ?? "—",
        diasOtorgados: t.vacation_days_per_year,
        diasUtilizados: Math.max(0, t.vacation_days_per_year - t.vacation_balance),
        diasDisponibles: t.vacation_balance,
        fechaIngreso: t.hire_date,
        reinicioVacaciones: nextReset,
        periodoVacacional: lastReset && nextReset ? `${dmy(lastReset)} – ${dmy(nextReset)}` : "—",
        fechaSolicitud: v.created_at,
        fechaAutorizacion: v.resolved_at,
        fechaInicio: v.start_date,
        fechaFin: v.end_date,
        totalDiasTomados: v.days,
        estatus: v.status,
        autorizadoPor: resolver?.display_name ?? null,
      } satisfies VacationReportRow;
    })
    .filter((r): r is VacationReportRow => r !== null)
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName) || b.fechaInicio.localeCompare(a.fechaInicio));

  // ── Tarjeta resumen (independiente del filtro de estado, pensada sobre
  //    el equipo completo — igual que hoy en admin/vacaciones/client.tsx) ──
  const anio = String(filters.year ?? new Date().getFullYear());
  const tomadasEsteAnio = ((vacs ?? []) as VacRow[]).filter((v) => v.status === "Aprobada" && v.start_date.startsWith(anio)).length;
  const in30Days = (t: TeamRow) => {
    if (!t.hire_date) return false;
    const next = nextAnniversary(t.hire_date);
    const diff = Math.round((new Date(next + "T12:00:00Z").getTime() - Date.now()) / 86400000);
    return diff >= 0 && diff <= 30;
  };
  const teamArr = (team ?? []) as TeamRow[];
  const summary: VacationSummary = {
    tomadasEsteAnio,
    proximosReinicios: teamArr.filter(in30Days).length,
    saldoBajo: teamArr.filter((t) => t.vacation_balance < 5).length,
  };

  return { rows, summary };
}

export const VACATION_COLUMNS: ReportColumn<VacationReportRow>[] = [
  { header: "Empleado", width: 24, align: "left", get: (r) => r.employeeName },
  { header: "Departamento", width: 20, align: "left", get: (r) => r.departmentName },
  { header: "Días otorgados", width: 13, format: "number", get: (r) => r.diasOtorgados },
  { header: "Días utilizados", width: 13, format: "number", get: (r) => r.diasUtilizados },
  { header: "Días disponibles", width: 14, format: "number", get: (r) => r.diasDisponibles },
  { header: "Fecha de ingreso", width: 14, format: "date", get: (r) => r.fechaIngreso },
  { header: "Reinicio de vacaciones", width: 16, format: "date", get: (r) => r.reinicioVacaciones },
  { header: "Período vacacional", width: 22, align: "left", get: (r) => r.periodoVacacional },
  { header: "Fecha de solicitud", width: 14, format: "date", get: (r) => r.fechaSolicitud },
  { header: "Fecha de autorización", width: 16, format: "date", get: (r) => r.fechaAutorizacion },
  { header: "Fecha inicio", width: 12, format: "date", get: (r) => r.fechaInicio },
  { header: "Fecha fin", width: 12, format: "date", get: (r) => r.fechaFin },
  { header: "Total de días tomados", width: 13, format: "number", get: (r) => r.totalDiasTomados },
  {
    header: "Estatus", width: 14, get: (r) => r.estatus,
    tint: (r) => VACATION_STATUS_COLORS[r.estatus],
  },
  { header: "Quién autorizó", width: 20, align: "left", get: (r) => r.autorizadoPor ?? "—" },
];

const VACATION_STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  "Aprobada": { bg: "D1FAE5", fg: "065F46" },
  "Pendiente": { bg: "FEF3C7", fg: "92400E" },
  "Rechazada": { bg: "FEE2E2", fg: "991B1B" },
  "Cancelada": { bg: "F1F5F9", fg: "475569" },
};

/** Opciones para el filtro "Estatus" de la landing — misma fuente que el
 *  tint del Excel. */
export const VACATION_REPORT_STATUS_OPTIONS = Object.keys(VACATION_STATUS_COLORS)
  .map((label) => ({ value: label, label }));
