"use client";
/* ═══════════════════════════════════════════════════════════════
   EMET · Reportes — landing de los 4 reportes operativos
   ═══════════════════════════════════════════════════════════════
   Rediseño 7 ago 2026 (docs/audits/report-system-audit.md). Nada de
   KPIs/gráficas sueltas: cuatro reportes accionables, cada uno con su
   DateRangeFilter único + filtros combinables, y TODA la descarga pasa
   por el ReportEngine (downloadReportXlsx). Imprimir = window.print
   sobre la misma tabla (el navegador manda el PDF).

   Los catálogos (equipo, coordinaciones) los trae page.tsx (server);
   los datos de cada reporte se consultan aquí con el cliente browser
   vía los motores de src/lib/reports/* (misma fuente que el Excel, así
   la pantalla y el archivo nunca se desincronizan).
   ═══════════════════════════════════════════════════════════════ */
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/shared";
import { Button, SegmentPill } from "@/components/os/ui";
import { Select, type SelectOption } from "@/components/select";
import { DateRangeFilter, useDateRangeFilter } from "@/components/reports/date-range-filter";
import { buildGeneratedAtLabel, buildPeriodLabel, downloadReportXlsx, formatReportCell } from "@/lib/reports/xlsx-builder";
import type { DateFilterValue, ReportColumn, ReportHeaderInfo, ReportWorkbookConfig } from "@/lib/reports/types";
import { fetchAttendanceReportRows, ATTENDANCE_COLUMNS, ATTENDANCE_REPORT_STATUS_OPTIONS, type AttendanceReportRow } from "@/lib/reports/attendance";
import { fetchVacationReportRows, VACATION_COLUMNS, VACATION_REPORT_STATUS_OPTIONS, type VacationReportRow, type VacationSummary } from "@/lib/reports/vacations";
import { fetchDepartmentPendingReport, DEPARTMENT_PENDING_COLUMNS, DEPARTMENT_PENDING_STATUS_OPTIONS, type DepartmentPendingRow, type DepartmentPendingCharts } from "@/lib/reports/department-pending";
import { fetchEventByPersonRows, EVENT_BY_PERSON_COLUMNS, EVENT_REPORT_STATUS_OPTIONS, EVENT_REPORT_ROLE_OPTIONS, type EventByPersonRow, type EventByPersonSummary } from "@/lib/reports/events";
import { INSTITUTIONAL_KIND_LABEL } from "@/lib/ui-maps";
import { logAdminAction } from "@/lib/admin-log";

type TeamRow = {
  id: string; display_name: string; nexus_color: string | null; avatar_url: string | null;
  area: string | null; area_id: string | null;
  departments: { id: string; nombre: string } | { id: string; nombre: string }[] | null;
};
type DeptRow = { id: string; nombre: string; tipo: string };

type ReportTab = "asistencia" | "vacaciones" | "pendientes" | "eventos";

const TABS: { key: ReportTab; label: string }[] = [
  { key: "asistencia", label: "Asistencia" },
  { key: "vacaciones", label: "Vacaciones" },
  { key: "pendientes", label: "Pendientes por coordinación" },
  { key: "eventos", label: "Eventos por persona" },
];

export function ReportesClient({ team, departments, adminId, generatedBy }: {
  team: TeamRow[]; departments: DeptRow[]; adminId: string; generatedBy: string;
}) {
  const [tab, setTab] = useState<ReportTab>("asistencia");

  return (
    <>
      <PageHeader
        title="Reportes"
        subtitle="Cuatro reportes operativos · filtro de fecha único · exportación Excel profesional"
      />
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {TABS.map((t) => (
          <SegmentPill key={t.key} active={tab === t.key} onClick={() => setTab(t.key)}>
            {t.label}
          </SegmentPill>
        ))}
      </div>

      {tab === "asistencia" && <AsistenciaTab team={team} departments={departments} adminId={adminId} generatedBy={generatedBy} />}
      {tab === "vacaciones" && <VacacionesTab team={team} departments={departments} adminId={adminId} generatedBy={generatedBy} />}
      {tab === "pendientes" && <PendientesTab departments={departments} adminId={adminId} generatedBy={generatedBy} />}
      {tab === "eventos" && <EventosTab team={team} adminId={adminId} generatedBy={generatedBy} />}
    </>
  );
}

/* ────────────────────────────────────────────────────────────────
   Helpers compartidos
   ──────────────────────────────────────────────────────────────── */
function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    fn().then((d) => { if (alive) { setData(d); setLoading(false); } })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { data, loading };
}

/** Traduce los filtros activos a los pares {label, value} del encabezado
 *  institucional — "Todos" si la dimensión no se filtró. */
function appliedFilters(filters: { label: string; value: string | null }[]): { label: string; value: string }[] {
  return filters.map(({ label, value }) => ({
    label,
    value: value && value !== "" ? value : "Todos",
  }));
}

function ReportToolbar({ onExport, onPrint, busy, hasRows }: {
  onExport: () => void; onPrint: () => void; busy: boolean; hasRows: boolean;
}) {
  return (
    <div className="flex items-center gap-2 no-print">
      <Button size="sm" icon="download" disabled={busy || !hasRows} onClick={onExport}>
        {busy ? "Generando…" : "Exportar Excel"}
      </Button>
      <Button size="sm" variant="subtle" onClick={onPrint}>Guardar como PDF</Button>
    </div>
  );
}

function ReportTable<T>({ columns, rows }: { columns: ReportColumn<T>[]; rows: T[] }) {
  return (
    <div className="overflow-x-auto nx-scroll">
      <table className="w-full text-[13px]">
        <thead>
          <tr style={{ color: "var(--text-3)" }} className="text-left">
            {columns.map((c) => (
              <th key={c.header} className="font-semibold pb-3 pr-4 whitespace-nowrap">{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t transition-colors hover:bg-hover" style={{ borderColor: "var(--border)" }}>
              {columns.map((c) => (
                <td key={c.header} className="py-2.5 pr-4 whitespace-nowrap tabular-nums"
                  style={{ textAlign: c.align === "right" ? "right" : c.align === "center" ? "center" : "left" }}>
                  {String(formatReportCell(c, row)) || "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SummaryCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="card px-4 py-3.5">
      <p className="text-[12px] font-bold" style={{ color: "var(--text-3)" }}>{label}</p>
      <p className="text-[24px] font-bold mt-1 tabular-nums leading-none text-text-1">{value}</p>
      {hint && <p className="text-[12px] mt-1.5" style={{ color: "var(--text-2)" }}>{hint}</p>}
    </div>
  );
}

const personOptions = (team: TeamRow[]): SelectOption[] => [
  { value: "", label: "Todos" },
  ...team.map((u) => ({
    value: u.id, label: u.display_name,
    avatar: { name: u.display_name, color: u.nexus_color, avatarUrl: u.avatar_url },
  })),
];

const deptOptions = (departments: DeptRow[]): SelectOption[] => [
  { value: "", label: "Todos" },
  ...departments.map((d) => ({ value: d.id, label: d.nombre })),
];

/* ────────────────────────────────────────────────────────────────
   Reporte 1 · Asistencia
   ──────────────────────────────────────────────────────────────── */
function AsistenciaTab({ team, departments, adminId, generatedBy }: {
  team: TeamRow[]; departments: DeptRow[]; adminId: string; generatedBy: string;
}) {
  const [dateFilter, setDateFilter] = useDateRangeFilter("asistencia");
  const [employeeId, setEmployeeId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [status, setStatus] = useState("");

  const load = useCallback(() =>
    fetchAttendanceReportRows(createClient(), {
      range: dateFilter.range,
      employeeId: employeeId || null,
      departmentId: departmentId || null,
      status: status || null,
    }), [dateFilter.range, employeeId, departmentId, status]);
  const { data, loading } = useAsync(load, [dateFilter.range, employeeId, departmentId, status]);
  const rows = data ?? [];

  const buildHeader = (): ReportHeaderInfo => ({
    title: "Asistencia",
    periodLabel: buildPeriodLabel(dateFilter.range),
    generatedAtLabel: buildGeneratedAtLabel(),
    generatedByLabel: generatedBy,
    appliedFilters: appliedFilters([
      { label: "Empleado", value: employeeId },
      { label: "Departamento", value: departmentId },
      { label: "Estado del día", value: status },
    ]),
  });

  const exportExcel = async () => {
    const config: ReportWorkbookConfig<AttendanceReportRow> = {
      header: buildHeader(),
      columns: ATTENDANCE_COLUMNS,
      rows,
      filenameBase: "asistencia",
    };
    await downloadReportXlsx(config);
    if (adminId) logAdminAction(createClient(), adminId, "Exportó reporte", "asistencia.xlsx");
  };

  return (
    <ReportShell
      rangeLabel={buildPeriodLabel(dateFilter.range)}
      filters={
        <FilterRow>
          <DateRangeFilter value={dateFilter} onChange={setDateFilter} />
          <Select value={employeeId} onChange={setEmployeeId} options={personOptions(team)} placeholder="Empleado" title="Filtrar por empleado" className="field-input w-[190px]" />
          <Select value={departmentId} onChange={setDepartmentId} options={deptOptions(departments)} placeholder="Departamento" title="Filtrar por departamento" className="field-input w-[190px]" />
          <Select value={status} onChange={setStatus} options={[{ value: "", label: "Todos" }, ...ATTENDANCE_REPORT_STATUS_OPTIONS]} placeholder="Estado del día" title="Filtrar por estado" className="field-input w-[190px]" />
        </FilterRow>
      }
      toolbar={<ReportToolbar hasRows={rows.length > 0} busy={false} onExport={exportExcel} onPrint={() => window.print()} />}
      loading={loading}
      empty={rows.length === 0}
      table={<ReportTable columns={ATTENDANCE_COLUMNS} rows={rows} />}
      count={rows.length}
    />
  );
}

/* ────────────────────────────────────────────────────────────────
   Reporte 2 · Vacaciones
   ──────────────────────────────────────────────────────────────── */
function VacacionesTab({ team, departments, adminId, generatedBy }: {
  team: TeamRow[]; departments: DeptRow[]; adminId: string; generatedBy: string;
}) {
  const [dateFilter, setDateFilter] = useDateRangeFilter("vacaciones");
  const [employeeId, setEmployeeId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [status, setStatus] = useState("");
  const [year, setYear] = useState("");

  const load = useCallback(() =>
    fetchVacationReportRows(createClient(), {
      range: dateFilter.range,
      employeeId: employeeId || null,
      departmentId: departmentId || null,
      status: status || null,
      year: year ? Number(year) : null,
    }), [dateFilter.range, employeeId, departmentId, status, year]);
  const { data, loading } = useAsync(load, [dateFilter.range, employeeId, departmentId, status, year]);
  const rows = data?.rows ?? [];
  const summary: VacationSummary | null = data?.summary ?? null;

  const yearOptions: SelectOption[] = [
    { value: "", label: "Todos" },
    ...Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map((y) => ({ value: String(y), label: String(y) })),
  ];

  const buildHeader = (): ReportHeaderInfo => ({
    title: "Vacaciones",
    periodLabel: year ? `Año ${year}` : buildPeriodLabel(dateFilter.range),
    generatedAtLabel: buildGeneratedAtLabel(),
    generatedByLabel: generatedBy,
    appliedFilters: appliedFilters([
      { label: "Empleado", value: employeeId },
      { label: "Departamento", value: departmentId },
      { label: "Estatus", value: status },
      { label: "Periodo", value: year },
    ]),
  });

  const exportExcel = async () => {
    const config: ReportWorkbookConfig<VacationReportRow> = {
      header: buildHeader(),
      columns: VACATION_COLUMNS,
      rows,
      filenameBase: "vacaciones",
      summary: summary ? [
        { label: "Tomadas este año", value: summary.tomadasEsteAnio },
        { label: "Próximos reinicios", value: summary.proximosReinicios },
        { label: "Saldo bajo (<5 días)", value: summary.saldoBajo },
      ] : undefined,
    };
    await downloadReportXlsx(config);
    if (adminId) logAdminAction(createClient(), adminId, "Exportó reporte", "vacaciones.xlsx");
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <SummaryCard label="Tomadas este año" value={summary?.tomadasEsteAnio ?? "—"} />
        <SummaryCard label="Próximos reinicios" value={summary?.proximosReinicios ?? "—"} hint="en los próximos 30 días" />
        <SummaryCard label="Saldo bajo" value={summary?.saldoBajo ?? "—"} hint="empleados con menos de 5 días disponibles" />
      </div>
      <ReportShell
        rangeLabel={buildPeriodLabel(dateFilter.range)}
        filters={
          <FilterRow>
            <DateRangeFilter value={dateFilter} onChange={setDateFilter} />
            <Select value={employeeId} onChange={setEmployeeId} options={personOptions(team)} placeholder="Empleado" title="Filtrar por empleado" className="field-input w-[190px]" />
            <Select value={departmentId} onChange={setDepartmentId} options={deptOptions(departments)} placeholder="Departamento" title="Filtrar por departamento" className="field-input w-[190px]" />
            <Select value={status} onChange={setStatus} options={[{ value: "", label: "Todos" }, ...VACATION_REPORT_STATUS_OPTIONS]} placeholder="Estatus" title="Filtrar por estatus" className="field-input w-[190px]" />
            <Select value={year} onChange={setYear} options={yearOptions} placeholder="Año" title="Filtrar por año" className="field-input w-[130px]" />
          </FilterRow>
        }
        toolbar={<ReportToolbar hasRows={rows.length > 0} busy={false} onExport={exportExcel} onPrint={() => window.print()} />}
        loading={loading}
        empty={rows.length === 0}
        table={<ReportTable columns={VACATION_COLUMNS} rows={rows} />}
        count={rows.length}
      />
    </>
  );
}

/* ────────────────────────────────────────────────────────────────
   Reporte 3 · Pendientes por coordinación
   ──────────────────────────────────────────────────────────────── */
function PendientesTab({ departments, adminId, generatedBy }: {
  departments: DeptRow[]; adminId: string; generatedBy: string;
}) {
  const [dateFilter, setDateFilter] = useDateRangeFilter("pendientes");
  const [departmentId, setDepartmentId] = useState("");
  const [status, setStatus] = useState("");

  const load = useCallback(() =>
    fetchDepartmentPendingReport(createClient(), {
      range: dateFilter.range,
      departmentId: departmentId || null,
      status: status || null,
    }), [dateFilter.range, departmentId, status]);
  const { data, loading } = useAsync(load, [dateFilter.range, departmentId, status]);
  const rows: DepartmentPendingRow[] = data?.rows ?? [];
  const charts: DepartmentPendingCharts | null = data?.charts ?? null;

  const buildHeader = (): ReportHeaderInfo => ({
    title: "Pendientes por coordinación",
    periodLabel: buildPeriodLabel(dateFilter.range),
    generatedAtLabel: buildGeneratedAtLabel(),
    generatedByLabel: generatedBy,
    appliedFilters: appliedFilters([
      { label: "Coordinación", value: departmentId },
      { label: "Estado de solicitud", value: status },
    ]),
  });

  const exportExcel = async () => {
    const config: ReportWorkbookConfig<DepartmentPendingRow> = {
      header: buildHeader(),
      columns: DEPARTMENT_PENDING_COLUMNS,
      rows,
      filenameBase: "pendientes-por-coordinacion",
    };
    await downloadReportXlsx(config);
    if (adminId) logAdminAction(createClient(), adminId, "Exportó reporte", "pendientes-por-coordinacion.xlsx");
  };

  return (
    <>
      {charts && <SparklineCard charts={charts} />}
      <ReportShell
        rangeLabel={buildPeriodLabel(dateFilter.range)}
        filters={
          <FilterRow>
            <DateRangeFilter value={dateFilter} onChange={setDateFilter} />
            <Select value={departmentId} onChange={setDepartmentId} options={deptOptions(departments)} placeholder="Coordinación" title="Filtrar por coordinación" className="field-input w-[210px]" />
            <Select value={status} onChange={setStatus} options={[{ value: "", label: "Todos" }, ...DEPARTMENT_PENDING_STATUS_OPTIONS]} placeholder="Estado de solicitud" title="Filtrar por estado" className="field-input w-[190px]" />
          </FilterRow>
        }
        toolbar={<ReportToolbar hasRows={rows.length > 0} busy={false} onExport={exportExcel} onPrint={() => window.print()} />}
        loading={loading}
        empty={rows.length === 0}
        table={<ReportTable columns={DEPARTMENT_PENDING_COLUMNS} rows={rows} />}
        count={rows.length}
      />
    </>
  );
}

function SparklineCard({ charts }: { charts: DepartmentPendingCharts }) {
  const weeks = charts.weekLabels;
  const series = [
    { label: "Creados por semana", values: charts.creadosPorSemana, color: "var(--accent)" },
    { label: "Terminados por semana", values: charts.terminadosPorSemana, color: "var(--ok)" },
    { label: "Tiempo promedio (h)", values: charts.tiempoPromedioPorSemana, color: "var(--warn)" },
  ];
  return (
    <div className="card p-5 mb-5">
      <div className="grid sm:grid-cols-3 gap-5">
        {series.map((s) => (
          <div key={s.label}>
            <p className="text-[12px] font-semibold mb-2" style={{ color: "var(--text-3)" }}>{s.label}</p>
            <Sparkline values={s.values.map((v) => v ?? 0)} color={s.color} weeks={weeks} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Sparkline({ values, color, weeks }: { values: number[]; color: string; weeks: string[] }) {
  const width = 240, height = 46;
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const range = max - min || 1;
  const stepX = values.length > 1 ? width / (values.length - 1) : 0;
  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  });
  return (
    <div>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible max-w-full">
        <polyline points={points.join(" ")} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {weeks.length > 1 && (
        <p className="text-[11px] mt-1 tabular-nums" style={{ color: "var(--text-3)" }}>
          {weeks[0].slice(5).replace("-", "/")} → {weeks[weeks.length - 1].slice(5).replace("-", "/")}
        </p>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Reporte 4 · Eventos por persona
   ──────────────────────────────────────────────────────────────── */
function EventosTab({ team, adminId, generatedBy }: {
  team: TeamRow[]; adminId: string; generatedBy: string;
}) {
  const [dateFilter, setDateFilter] = useDateRangeFilter("eventos");
  const [employeeId, setEmployeeId] = useState("");
  const [role, setRole] = useState("");
  const [eventType, setEventType] = useState("");
  const [status, setStatus] = useState("");

  const load = useCallback(() =>
    fetchEventByPersonRows(createClient(), {
      range: dateFilter.range,
      employeeId: employeeId || null,
      role: (role || null) as "responsable" | "participante" | null,
      eventType: eventType || null,
      status: status || null,
    }), [dateFilter.range, employeeId, role, eventType, status]);
  const { data, loading } = useAsync(load, [dateFilter.range, employeeId, role, eventType, status]);
  const rows: EventByPersonRow[] = data?.rows ?? [];
  const summary: EventByPersonSummary | null = data?.summary ?? null;

  const typeOptions: SelectOption[] = [
    { value: "", label: "Todos" },
    ...Object.entries(INSTITUTIONAL_KIND_LABEL).map(([value, label]) => ({ value, label })),
  ];

  const buildHeader = (): ReportHeaderInfo => ({
    title: "Eventos por persona",
    periodLabel: buildPeriodLabel(dateFilter.range),
    generatedAtLabel: buildGeneratedAtLabel(),
    generatedByLabel: generatedBy,
    appliedFilters: appliedFilters([
      { label: "Empleado", value: employeeId },
      { label: "Rol", value: role },
      { label: "Tipo de evento", value: eventType },
      { label: "Estado", value: status },
    ]),
  });

  const exportExcel = async () => {
    const config: ReportWorkbookConfig<EventByPersonRow> = {
      header: buildHeader(),
      columns: EVENT_BY_PERSON_COLUMNS,
      rows,
      filenameBase: "eventos-por-persona",
      summary: summary ? [
        { label: "Personas en eventos", value: summary.personas },
        { label: "Eventos terminados", value: summary.terminados },
        { label: "Eventos pendientes", value: summary.pendientes },
        { label: "Horas invertidas", value: `${summary.horasTotales}h` },
      ] : undefined,
    };
    await downloadReportXlsx(config);
    if (adminId) logAdminAction(createClient(), adminId, "Exportó reporte", "eventos-por-persona.xlsx");
  };

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <SummaryCard label="Personas en eventos" value={summary?.personas ?? "—"} />
        <SummaryCard label="Eventos terminados" value={summary?.terminados ?? "—"} />
        <SummaryCard label="Eventos pendientes" value={summary?.pendientes ?? "—"} />
        <SummaryCard label="Horas invertidas" value={summary ? `${summary.horasTotales}h` : "—"} />
      </div>
      <ReportShell
        rangeLabel={buildPeriodLabel(dateFilter.range)}
        filters={
          <FilterRow>
            <DateRangeFilter value={dateFilter} onChange={setDateFilter} />
            <Select value={employeeId} onChange={setEmployeeId} options={personOptions(team)} placeholder="Empleado" title="Filtrar por empleado" className="field-input w-[190px]" />
            <Select value={role} onChange={setRole} options={[{ value: "", label: "Todos" }, ...EVENT_REPORT_ROLE_OPTIONS]} placeholder="Rol" title="Filtrar por rol" className="field-input w-[150px]" />
            <Select value={eventType} onChange={setEventType} options={typeOptions} placeholder="Tipo de evento" title="Filtrar por tipo" className="field-input w-[170px]" />
            <Select value={status} onChange={setStatus} options={[{ value: "", label: "Todos" }, ...EVENT_REPORT_STATUS_OPTIONS]} placeholder="Estado" title="Filtrar por estado" className="field-input w-[150px]" />
          </FilterRow>
        }
        toolbar={<ReportToolbar hasRows={rows.length > 0} busy={false} onExport={exportExcel} onPrint={() => window.print()} />}
        loading={loading}
        empty={rows.length === 0}
        table={<ReportTable columns={EVENT_BY_PERSON_COLUMNS} rows={rows} />}
        count={rows.length}
      />
    </>
  );
}

/* ────────────────────────────────────────────────────────────────
   Cascarón de cada pestaña
   ──────────────────────────────────────────────────────────────── */
function FilterRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-start gap-3">{children}</div>;
}

function ReportShell({ rangeLabel, filters, toolbar, loading, empty, table, count }: {
  rangeLabel: string; filters: React.ReactNode; toolbar: React.ReactNode;
  loading: boolean; empty: boolean; table: React.ReactNode; count: number;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div className="min-w-0">
          <p className="text-[12px] font-bold" style={{ color: "var(--text-3)" }}>Periodo</p>
          <p className="text-[14.5px] font-bold text-text-1">{rangeLabel}</p>
        </div>
        {toolbar}
      </div>
      <div className="mb-5">{filters}</div>
      {loading ? (
        <p className="text-[14px] py-8 text-center" style={{ color: "var(--text-3)" }}>Cargando…</p>
      ) : empty ? (
        <p className="text-[14px] py-8 text-center" style={{ color: "var(--text-3)" }}>Sin datos para este periodo.</p>
      ) : (
        <>
          <p className="text-[12px] font-semibold mb-3" style={{ color: "var(--text-3)" }}>
            {count} {count === 1 ? "fila" : "filas"}
          </p>
          {table}
        </>
      )}
    </div>
  );
}
