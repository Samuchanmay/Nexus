// ══════════════════════════════════════════════════════════════════
//  EMET · ReportEngine — Reporte 3: Pendientes por coordinación
//  ══════════════════════════════════════════════════════════════════
//  Reemplaza al viejo dashboard de /admin/reportes (KPIs de "tendencia",
//  "cuello de botella", etc. — eliminado en Task #9, ver docs/audits/
//  report-system-audit.md). Usa `requests.department_id` (FK real,
//  migración 0050) en vez del texto libre `requester_area` que usaba el
//  dashboard viejo — así "Coordinación" agrupa de forma confiable.
//
//  "Departamento" y "Coordinación" son la MISMA columna en este sistema
//  (tabla `departments`, campo `tipo` discriminador — confirmado en la
//  auditoría de este mismo rediseño, no son dos conceptos distintos). El
//  filtro combinado de este reporte usa un solo `departmentId`.
//
//  Terminado = existe un `projects` con `completed_at` no nulo para esa
//  solicitud (única señal real de "se acabó el trabajo" — `requests.status`
//  no tiene un timestamp de cierre propio). Tiempo de resolución =
//  completed_at − requests.created_at.
// ══════════════════════════════════════════════════════════════════
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays } from "@/lib/tz";
import type { DateRange, ReportColumn } from "./types";

export interface DepartmentPendingRow {
  departmentId: string | null;
  departmentName: string;
  pendientes: number;
  terminados: number;
  pendientesAbiertos: number;
  tiempoPromedioHoras: number | null;
}

export interface DepartmentPendingFilters {
  range: DateRange;
  departmentId?: string | null;
  status?: string | null;
}

export interface DepartmentPendingCharts {
  weekLabels: string[];
  creadosPorSemana: number[];
  terminadosPorSemana: number[];
  tiempoPromedioPorSemana: (number | null)[]; // horas
}

const OPEN_STATUSES = new Set(["solicitada", "aprobada", "en_progreso", "en_revision", "pausada"]);

/** Opciones para el filtro "Estado" de la landing — el status de requests
 *  (no el estado del proyecto; ver comentario de cabecera: Terminado se
 *  decide por projects.completed_at). */
export const DEPARTMENT_PENDING_STATUS_OPTIONS = [
  { value: "solicitada", label: "Por revisar" },
  { value: "aprobada", label: "Aprobada" },
  { value: "en_progreso", label: "En progreso" },
  { value: "en_revision", label: "En revisión" },
  { value: "completada", label: "Completada" },
  { value: "pausada", label: "Pausada" },
  { value: "cancelada", label: "Cancelada" },
];

function mondayOf(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  const dow = d.getUTCDay();
  const delta = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export async function fetchDepartmentPendingReport(
  supabase: SupabaseClient,
  filters: DepartmentPendingFilters,
): Promise<{ rows: DepartmentPendingRow[]; charts: DepartmentPendingCharts }> {
  let reqQuery = supabase
    .from("requests")
    .select("id, department_id, requester_area, status, created_at, departments(id, nombre)")
    .gte("created_at", filters.range.from).lte("created_at", `${filters.range.to}T23:59:59`);
  if (filters.departmentId) reqQuery = reqQuery.eq("department_id", filters.departmentId);
  if (filters.status) reqQuery = reqQuery.eq("status", filters.status);

  const { data: reqs } = await reqQuery;
  const requestIds = (reqs ?? []).map((r) => r.id as string);
  const { data: projs } = requestIds.length
    ? await supabase.from("projects").select("request_id, completed_at").in("request_id", requestIds)
    : { data: [] as { request_id: string; completed_at: string | null }[] };

  const completedAtByRequest = new Map(
    (projs ?? []).filter((p) => p.completed_at).map((p) => [p.request_id as string, p.completed_at as string]),
  );

  type ReqRow = {
    id: string; department_id: string | null; requester_area: string | null; status: string; created_at: string;
    departments: { id: string; nombre: string } | { id: string; nombre: string }[] | null;
  };

  // ── Agregado por coordinación/departamento ──
  const byDept = new Map<string, DepartmentPendingRow & { _hours: number[] }>();
  for (const r of (reqs ?? []) as ReqRow[]) {
    const dept = Array.isArray(r.departments) ? r.departments[0] : r.departments;
    const key = r.department_id ?? "__sin_departamento__";
    const name = dept?.nombre ?? r.requester_area?.trim() ?? "Sin departamento";
    const acc = byDept.get(key) ?? { departmentId: r.department_id, departmentName: name, pendientes: 0, terminados: 0, pendientesAbiertos: 0, tiempoPromedioHoras: null, _hours: [] };
    acc.pendientes += 1;
    const completedAt = completedAtByRequest.get(r.id);
    if (completedAt) {
      acc.terminados += 1;
      const hrs = (new Date(completedAt).getTime() - new Date(r.created_at).getTime()) / 3_600_000;
      if (hrs >= 0) acc._hours.push(hrs);
    } else if (OPEN_STATUSES.has(r.status)) {
      acc.pendientesAbiertos += 1;
    }
    byDept.set(key, acc);
  }
  const rows: DepartmentPendingRow[] = [...byDept.values()]
    .map(({ _hours, ...rest }) => ({
      ...rest,
      tiempoPromedioHoras: _hours.length ? Math.round((_hours.reduce((a, b) => a + b, 0) / _hours.length) * 10) / 10 : null,
    }))
    .sort((a, b) => b.pendientes - a.pendientes);

  // ── Series semanales para las 3 gráficas (sparkline SVG, sin librería) ──
  const weekKeys: string[] = [];
  { let wk = mondayOf(filters.range.from); const lastWk = mondayOf(filters.range.to);
    let guard = 0;
    while (wk <= lastWk && guard++ < 260) { weekKeys.push(wk); wk = addDays(wk, 7); }
    if (weekKeys.length === 0) weekKeys.push(mondayOf(filters.range.from));
  }
  const creadosPorSemana = weekKeys.map(() => 0);
  const terminadosPorSemana = weekKeys.map(() => 0);
  const horasPorSemana: number[][] = weekKeys.map(() => []);
  const weekIndex = new Map(weekKeys.map((wk, i) => [wk, i]));

  for (const r of (reqs ?? []) as ReqRow[]) {
    const wk = mondayOf(r.created_at.slice(0, 10));
    const idx = weekIndex.get(wk);
    if (idx === undefined) continue;
    creadosPorSemana[idx] += 1;
    const completedAt = completedAtByRequest.get(r.id);
    if (completedAt) {
      terminadosPorSemana[idx] += 1;
      const hrs = (new Date(completedAt).getTime() - new Date(r.created_at).getTime()) / 3_600_000;
      if (hrs >= 0) horasPorSemana[idx].push(hrs);
    }
  }
  const tiempoPromedioPorSemana = horasPorSemana.map((hrs) => hrs.length ? Math.round((hrs.reduce((a, b) => a + b, 0) / hrs.length) * 10) / 10 : null);

  return {
    rows,
    charts: { weekLabels: weekKeys, creadosPorSemana, terminadosPorSemana, tiempoPromedioPorSemana },
  };
}

export const DEPARTMENT_PENDING_COLUMNS: ReportColumn<DepartmentPendingRow>[] = [
  { header: "Coordinación", width: 26, align: "left", get: (r) => r.departmentName },
  { header: "Pendientes", width: 13, format: "number", get: (r) => r.pendientes },
  { header: "Terminados", width: 13, format: "number", get: (r) => r.terminados },
  { header: "Pendientes abiertos", width: 16, format: "number", get: (r) => r.pendientesAbiertos },
  {
    header: "Tiempo promedio", width: 16, align: "right",
    get: (r) => r.tiempoPromedioHoras == null ? "—" : r.tiempoPromedioHoras < 24
      ? `${r.tiempoPromedioHoras}h` : `${(r.tiempoPromedioHoras / 24).toFixed(1)}d`,
  },
];
