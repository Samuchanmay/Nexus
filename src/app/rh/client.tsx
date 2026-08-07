"use client";
// RH · Solo lectura. RH ve horas laboradas y vacaciones aprobadas.
// NUNCA ve retardos ni faltas — no existen en Emet.
import { useMemo, useState } from "react";
import { SlidingSegments, Avatar, Pill, Select } from "@/components/ui";
import { summarizeDay, fmtMin, scheduleFor } from "@/lib/hours";
import type { JornadaState } from "@/lib/hours";
import type { AttendanceRow, Schedule, Vacation } from "@/lib/types";
import { IconDownload } from "@/components/icons";
import { EmptyState } from "@/components/shared";
import { usePersistedView } from "@/lib/persisted-view";
import { Icon } from "@/components/os/icons";
import { todayMerida, addDays, shortDate, seniorityLabel, dmy, nextAnniversary } from "@/lib/tz";
import { VACATION_TONE } from "@/lib/ui-maps";
import { isBirthdayToday, todayISO } from "@/lib/birthday";
import { createClient } from "@/lib/supabase/client";
import { fetchAttendanceReportRows, ATTENDANCE_COLUMNS, type AttendanceReportRow } from "@/lib/reports/attendance";
import { fetchVacationReportRows, VACATION_COLUMNS, type VacationReportRow } from "@/lib/reports/vacations";
import { buildGeneratedAtLabel, buildPeriodLabel, downloadReportXlsx } from "@/lib/reports/xlsx-builder";
import type { ReportHeaderInfo, ReportWorkbookConfig } from "@/lib/reports/types";

type Member = {
  id: string; full_name: string; display_name: string; nexus_color: string | null; avatar_url: string | null; birth_date: string | null; area: string | null; title: string | null;
  vacation_balance: number; vacation_days_per_year: number; hire_date: string | null; vacation_balance_reset: string | null;
};

/** Semáforo de saldo — mismos umbrales que admin/vacaciones (verde <50%, amarillo 50-79%, rojo ≥80%). */
function balanceLabel(pctUsed: number): string {
  return pctUsed < 50 ? "Disponible" : pctUsed < 80 ? "Moderado" : "Crítico";
}

const MESES_LARGO = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

const PERIODS = ["Semana", "Quincena", "Mes", "Trimestre"];
const PERIOD_DAYS: Record<string, number> = { Semana: 7, Quincena: 15, Mes: 30, Trimestre: 92 };

export default function RHClient({ team, attendance, schedules, vacations, states }: {
  team: Member[]; attendance: AttendanceRow[]; schedules: Schedule[];
  vacations: Vacation[]; states: JornadaState[];
}) {
  const [period, setPeriod] = usePersistedView("rh.period", PERIODS, "Quincena");

  const cutoff = useMemo(() => addDays(todayMerida(), -PERIOD_DAYS[period]), [period]);

  const stats = useMemo(() => {
    const today = todayMerida();
    return team.map((u) => {
      const currentSched = scheduleFor(schedules, u.id, today) ?? { target_min: 480, tolerance_min: 15, end_time: "18:00:00" };
      const rows = attendance.filter((r) => r.user_id === u.id && r.date >= cutoff);
      const dates = [...new Set(rows.map((r) => r.date))];
      const days = dates.map((d) => summarizeDay(d, rows, scheduleFor(schedules, u.id, d) ?? { target_min: 480, tolerance_min: 15, end_time: "18:00:00" }, states));
      const closed = days.filter((d) => !d.isOpen);
      const total = closed.reduce((s, d) => s + d.totalMin, 0);
      const extra = closed.reduce((s, d) => s + d.extraMin, 0);
      return {
        user: u,
        daysWorked: closed.length,
        totalMin: total,
        extraMin: extra,
        avgMin: closed.length ? Math.round(total / closed.length) : 0,
        targetMin: currentSched.target_min,
      };
    });
  }, [team, attendance, schedules, cutoff, states]);

  const totals = useMemo(() => ({
    days: stats.reduce((s, x) => s + x.daysWorked, 0),
    min: stats.reduce((s, x) => s + x.totalMin, 0),
    extra: stats.reduce((s, x) => s + x.extraMin, 0),
  }), [stats]);

  const upcomingVacs = useMemo(() => {
    const today = todayMerida();
    return vacations.filter((v) => v.status === "Aprobada" && v.end_date >= today).sort((a, b) => a.start_date.localeCompare(b.start_date));
  }, [vacations]);

  // ── Resumen de vacaciones (equivalente a la pestaña RRHH del checador legado) ──
  const [vacSearch, setVacSearch] = useState("");
  const [reportUserId, setReportUserId] = useState("");
  const [historyYear, setHistoryYear] = useState("Todos");

  const vacSummary = useMemo(() => team
    .filter((m) => m.display_name.toLowerCase().includes(vacSearch.toLowerCase()))
    .map((m) => {
      const total = m.vacation_days_per_year || 0;
      const used = Math.max(0, total - m.vacation_balance);
      const pctUsed = total > 0 ? Math.round((used / total) * 100) : 0;
      return { m, used, pctUsed };
    }), [team, vacSearch]);

  const historyYears = useMemo(() =>
    [...new Set(vacations.map((v) => v.start_date.slice(0, 4)))].sort().reverse(), [vacations]);

  const historyByMonth = useMemo(() => {
    const filtered = historyYear === "Todos" ? vacations : vacations.filter((v) => v.start_date.startsWith(historyYear));
    const sorted = filtered.slice().sort((a, b) => b.start_date.localeCompare(a.start_date));
    const groups = new Map<string, Vacation[]>();
    for (const v of sorted) {
      const key = `${MESES_LARGO[Number(v.start_date.slice(5, 7)) - 1]} ${v.start_date.slice(0, 4)}`;
      const arr = groups.get(key) ?? [];
      arr.push(v);
      groups.set(key, arr);
    }
    return [...groups.entries()];
  }, [vacations, historyYear]);

  // ── Export Excel unificado (ReportEngine) — RH ya no arma CSV ni Excel
  //    propios: todo pasa por downloadReportXlsx() (src/lib/reports/*). ──
  const [exporting, setExporting] = useState<"asistencia" | "vacaciones" | "vacaciones-persona" | null>(null);

  const exportAttendanceExcel = async () => {
    setExporting("asistencia");
    try {
      const supabase = createClient();
      const range = { from: cutoff, to: todayMerida() };
      const rows = await fetchAttendanceReportRows(supabase, { range });
      const header: ReportHeaderInfo = {
        title: "Asistencia",
        periodLabel: buildPeriodLabel(range),
        generatedAtLabel: buildGeneratedAtLabel(),
        appliedFilters: [
          { label: "Periodo", value: period },
          { label: "Empleado", value: "Todos" },
          { label: "Departamento", value: "Todos" },
        ],
      };
      const config: ReportWorkbookConfig<AttendanceReportRow> = { header, columns: ATTENDANCE_COLUMNS, rows, filenameBase: "emet-rh-asistencia" };
      await downloadReportXlsx(config);
    } finally {
      setExporting(null);
    }
  };

  const exportVacationsExcel = async (employeeId?: string) => {
    setExporting(employeeId ? "vacaciones-persona" : "vacaciones");
    try {
      const supabase = createClient();
      const year = new Date().getFullYear();
      const { rows, summary } = await fetchVacationReportRows(supabase, { range: { from: `${year}-01-01`, to: `${year}-12-31` }, employeeId: employeeId || null });
      const header: ReportHeaderInfo = {
        title: "Vacaciones",
        periodLabel: `Año ${year}`,
        generatedAtLabel: buildGeneratedAtLabel(),
        appliedFilters: [
          { label: "Empleado", value: employeeId ? (team.find((t) => t.id === employeeId)?.full_name ?? employeeId) : "Todos" },
          { label: "Departamento", value: "Todos" },
          { label: "Estatus", value: "Todos" },
        ],
      };
      const config: ReportWorkbookConfig<VacationReportRow> = {
        header,
        columns: VACATION_COLUMNS,
        rows,
        filenameBase: employeeId ? "emet-rh-vacaciones-individual" : "emet-rh-vacaciones",
        summary: summary ? [
          { label: "Tomadas este año", value: summary.tomadasEsteAnio },
          { label: "Próximos reinicios", value: summary.proximosReinicios },
          { label: "Saldo bajo (<5 días)", value: summary.saldoBajo },
        ] : undefined,
      };
      await downloadReportXlsx(config);
    } finally {
      setExporting(null);
    }
  };

  return (
    <>
      <header className="pt-8 pb-5 flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight">Panel de horas</h1>
          <p className="text-[13.5px] mt-1" style={{ color: "var(--text-2)" }}>
            Horas laboradas del equipo · la comida cuenta como tiempo laborado
          </p>
        </div>
        <SlidingSegments options={PERIODS} value={period} onChange={setPeriod} />
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card p-5 text-center">
          <p className="text-[28px] font-bold tabular-nums">{totals.days}</p>
          <p className="text-[12px] font-semibold mt-0.5" style={{ color: "var(--text-3)" }}>Días con registro</p>
        </div>
        <div className="card p-5 text-center">
          <p className="text-[28px] font-bold tabular-nums">{fmtMin(totals.min)}</p>
          <p className="text-[12px] font-semibold mt-0.5" style={{ color: "var(--text-3)" }}>Horas del equipo</p>
        </div>
        <div className="card p-5 text-center">
          <p className="text-[28px] font-bold tabular-nums" style={{ color: totals.extra > 0 ? "var(--ok)" : undefined }}>
            {totals.extra > 0 ? `+${fmtMin(totals.extra)}` : "—"}
          </p>
          <p className="text-[12px] font-semibold mt-0.5" style={{ color: "var(--text-3)" }}>Tiempo extra</p>
        </div>
      </div>

      {/* Por empleado */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[16px] font-bold">Por empleado</h2>
        <div className="flex gap-2">
          <button onClick={exportAttendanceExcel} disabled={exporting !== null}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-[12.5px] font-semibold whitespace-nowrap"
            style={{ background: "var(--purple-tint)", color: "var(--purple)" }}>
            <IconDownload className="w-3.5 h-3.5" /> {exporting === "asistencia" ? "Generando…" : "Exportar Excel"}
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-2.5 mb-8">
        {stats.map((s) => (
          <div key={s.user.id} className="card px-5 py-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <Avatar name={s.user.display_name} color={s.user.nexus_color} avatarUrl={s.user.avatar_url} size={36} birthday={isBirthdayToday(s.user.birth_date, todayISO())} />
                <div>
                  <p className="text-[14px] font-bold">{s.user.full_name}</p>
                  <p className="text-[12px]" style={{ color: "var(--text-3)" }}>{s.user.title ?? s.user.area}</p>
                </div>
              </div>
              <div className="flex gap-5 text-center">
                <div>
                  <p className="text-[15px] font-bold tabular-nums">{s.daysWorked}</p>
                  <p className="text-[12px] font-semibold" style={{ color: "var(--text-3)" }}>Días</p>
                </div>
                <div>
                  <p className="text-[15px] font-bold tabular-nums">{fmtMin(s.totalMin)}</p>
                  <p className="text-[12px] font-semibold" style={{ color: "var(--text-3)" }}>Total</p>
                </div>
                <div>
                  <p className="text-[15px] font-bold tabular-nums">{s.daysWorked ? fmtMin(s.avgMin) : "—"}</p>
                  <p className="text-[12px] font-semibold" style={{ color: "var(--text-3)" }}>Promedio</p>
                </div>
                <div>
                  <p className="text-[15px] font-bold tabular-nums" style={{ color: s.extraMin > 0 ? "var(--ok)" : undefined }}>
                    {s.extraMin > 0 ? `+${fmtMin(s.extraMin)}` : "—"}
                  </p>
                  <p className="text-[12px] font-semibold" style={{ color: "var(--text-3)" }}>Extra</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Vacaciones próximas (solo lectura) */}
      <h2 className="text-[16px] font-bold mb-3">Vacaciones próximas</h2>
      {upcomingVacs.length === 0 ? (
        <div className="mb-8">
          <EmptyState icon={<Icon name="plane" size={22} />} title="Sin vacaciones próximas" hint="Las vacaciones aprobadas próximas a iniciar aparecerán aquí." />
        </div>
      ) : (
        <div className="flex flex-col gap-2.5 mb-8">
          {upcomingVacs.map((v) => (
            <div key={v.id} className="card px-5 py-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar name={v.users?.display_name ?? "?"} color={v.users?.nexus_color} avatarUrl={v.users?.avatar_url} size={32} birthday={isBirthdayToday(v.users?.birth_date, todayISO())} />
                <div>
                  <p className="text-[13.5px] font-bold">{v.users?.full_name}</p>
                  <p className="text-[12px]" style={{ color: "var(--text-2)" }}>
                    {dmy(v.start_date)} → {dmy(v.end_date)} · {v.days} {v.days === 1 ? "día hábil" : "días hábiles"}
                  </p>
                </div>
              </div>
              <Pill tone="ok">Aprobada</Pill>
            </div>
          ))}
        </div>
      )}

      {/* ═══ Resumen de vacaciones del equipo (equivalente a la pestaña RRHH del checador) ═══ */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-[16px] font-bold">Resumen de vacaciones</h2>
        <input
          className="field-input text-[12.5px] w-[200px]" placeholder="Buscar persona…"
          value={vacSearch} onChange={(e) => setVacSearch(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2.5 mb-8">
        {vacSummary.map(({ m, used, pctUsed }) => (
          <div key={m.id} className="card px-5 py-3.5 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <Avatar name={m.display_name} color={m.nexus_color} avatarUrl={m.avatar_url} size={34} birthday={isBirthdayToday(m.birth_date, todayISO())} />
              <div>
                <p className="text-[13.5px] font-bold">{m.full_name}</p>
                <p className="text-[12px]" style={{ color: "var(--text-3)" }}>
                  {seniorityLabel(m.hire_date) ?? m.area}
                  {m.hire_date && ` · reinicia ${shortDate(nextAnniversary(m.hire_date))}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-5 text-center">
              <div>
                <p className="text-[14px] font-bold tabular-nums">{used}</p>
                <p className="text-[12px] font-semibold" style={{ color: "var(--text-3)" }}>Tomados</p>
              </div>
              <div>
                <p className="text-[14px] font-bold tabular-nums" style={{ color: "var(--ok)" }}>{m.vacation_balance}</p>
                <p className="text-[12px] font-semibold" style={{ color: "var(--text-3)" }}>Restantes</p>
              </div>
              <Pill tone={pctUsed < 50 ? "ok" : pctUsed < 80 ? "warn" : "danger"}>
                {balanceLabel(pctUsed)} · {pctUsed}%
              </Pill>
            </div>
          </div>
        ))}
      </div>

      {/* Reportes */}
      <h2 className="text-[16px] font-bold mb-3">Reportes</h2>
      <div className="card p-4 mb-8 flex flex-col gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <Select
              value={reportUserId} onChange={setReportUserId}
              title="Seleccionar empleado" placeholder="Seleccionar empleado…"
              options={team.map((m) => ({
                value: m.id, label: m.full_name, sublabel: m.area ?? undefined,
                avatar: { name: m.full_name, color: m.nexus_color, avatarUrl: m.avatar_url },
              }))}
            />
          </div>
          <button
            className="btn-primary px-5 py-2.5 text-[13.5px]" disabled={!reportUserId}
            onClick={() => exportVacationsExcel(reportUserId)}>
            {exporting === "vacaciones-persona" ? "Generando…" : "Reporte individual"}
          </button>
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap pt-3" style={{ borderTop: "1px solid var(--border)" }}>
          <p className="text-[12.5px]" style={{ color: "var(--text-2)" }}>
            Resumen y movimientos de todo el equipo, listo para imprimir o guardar como PDF.
          </p>
          <button
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-full text-[13.5px] font-semibold shrink-0"
            style={{ background: "var(--purple-tint)", color: "var(--purple)" }}
            onClick={() => exportVacationsExcel(undefined)}>
            <IconDownload className="w-3.5 h-3.5" /> {exporting === "vacaciones" ? "Generando…" : "Reporte general (todos)"}
          </button>
        </div>
      </div>

      {/* Historial de movimientos */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-[16px] font-bold">Historial de movimientos</h2>
        <Select
          value={historyYear} onChange={setHistoryYear}
          className="field-input w-[120px] flex items-center justify-between gap-2 text-left"
          title="Año" searchable={false}
          options={[{ value: "Todos", label: "Todos" }, ...historyYears.map((y) => ({ value: y, label: y }))]}
        />
      </div>
      {historyByMonth.length === 0 ? (
        <EmptyState icon={<Icon name="clock" size={22} />} title="Sin movimientos registrados" hint="El historial de ajustes de saldo aparecerá aquí." />
      ) : (
        <div className="flex flex-col gap-5">
          {historyByMonth.map(([label, items]) => (
            <div key={label}>
              <p className="text-[12px] font-bold mb-2" style={{ color: "var(--text-3)" }}>{label}</p>
              <div className="flex flex-col gap-2">
                {items.map((v) => (
                  <div key={v.id} className="card px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <Avatar name={v.users?.display_name ?? "?"} color={v.users?.nexus_color} avatarUrl={v.users?.avatar_url} size={30} birthday={isBirthdayToday(v.users?.birth_date, todayISO())} />
                      <div>
                        <p className="text-[13.5px] font-bold">{v.users?.full_name}</p>
                        <p className="text-[12px]" style={{ color: "var(--text-3)" }}>{dmy(v.start_date)} → {dmy(v.end_date)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-semibold tabular-nums" style={{ color: "var(--text-2)" }}>{v.days} {v.days === 1 ? "día" : "días"}</span>
                      <Pill tone={VACATION_TONE[v.status]}>{v.status}</Pill>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
