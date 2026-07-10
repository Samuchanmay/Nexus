"use client";
// RH · Solo lectura. RH ve horas laboradas y vacaciones aprobadas.
// NUNCA ve retardos ni faltas — no existen en Nexus.
import { useMemo, useState } from "react";
import { SlidingSegments, Avatar, Pill } from "@/components/ui";
import { summarizeDay, fmtMin } from "@/lib/hours";
import type { JornadaState } from "@/lib/hours";
import type { AttendanceRow, Schedule, Vacation } from "@/lib/types";
import { IconDownload } from "@/components/icons";
import { todayMerida, addDays } from "@/lib/tz";

type Member = { id: string; full_name: string; display_name: string; nexus_color: string | null; area: string | null };

const PERIODS = ["Semana", "Quincena", "Mes", "Trimestre"];
const PERIOD_DAYS: Record<string, number> = { Semana: 7, Quincena: 15, Mes: 30, Trimestre: 92 };

export default function RHClient({ team, attendance, schedules, vacations, holidays, states }: {
  team: Member[]; attendance: AttendanceRow[]; schedules: Schedule[];
  vacations: Vacation[]; holidays: { date: string; name: string }[]; states: JornadaState[];
}) {
  const [period, setPeriod] = useState("Quincena");

  const cutoff = useMemo(() => addDays(todayMerida(), -PERIOD_DAYS[period]), [period]);

  const stats = useMemo(() => {
    return team.map((u) => {
      const sched = schedules.find((s) => s.user_id === u.id) ?? { target_min: 480, tolerance_min: 15 };
      const rows = attendance.filter((r) => r.user_id === u.id && r.date >= cutoff);
      const dates = [...new Set(rows.map((r) => r.date))];
      const days = dates.map((d) => summarizeDay(d, rows, sched, states));
      const closed = days.filter((d) => !d.isOpen);
      const total = closed.reduce((s, d) => s + d.totalMin, 0);
      const extra = closed.reduce((s, d) => s + d.extraMin, 0);
      return {
        user: u,
        daysWorked: closed.length,
        totalMin: total,
        extraMin: extra,
        avgMin: closed.length ? Math.round(total / closed.length) : 0,
        targetMin: sched.target_min,
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
    return vacations.filter((v) => v.end_date >= today).sort((a, b) => a.start_date.localeCompare(b.start_date));
  }, [vacations]);

  const exportCSV = () => {
    const sep = ",";
    const lines = [
      ["Empleado", "Área", "Días con registro", "Horas laboradas", "Promedio diario", "Tiempo extra", "Objetivo diario"].join(sep),
      ...stats.map((s) => [
        `"${s.user.full_name}"`, `"${s.user.area ?? ""}"`, s.daysWorked,
        (s.totalMin / 60).toFixed(2), (s.avgMin / 60).toFixed(2),
        (s.extraMin / 60).toFixed(2), (s.targetMin / 60).toFixed(2),
      ].join(sep)),
    ];
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `nexus-rh-${period.toLowerCase()}-${todayMerida()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
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
          <p className="text-[26px] font-bold tabular-nums">{totals.days}</p>
          <p className="text-[11px] font-semibold mt-0.5" style={{ color: "var(--text-3)" }}>Días con registro</p>
        </div>
        <div className="card p-5 text-center">
          <p className="text-[26px] font-bold tabular-nums">{fmtMin(totals.min)}</p>
          <p className="text-[11px] font-semibold mt-0.5" style={{ color: "var(--text-3)" }}>Horas del equipo</p>
        </div>
        <div className="card p-5 text-center">
          <p className="text-[26px] font-bold tabular-nums" style={{ color: totals.extra > 0 ? "var(--ok)" : undefined }}>
            {totals.extra > 0 ? `+${fmtMin(totals.extra)}` : "—"}
          </p>
          <p className="text-[11px] font-semibold mt-0.5" style={{ color: "var(--text-3)" }}>Tiempo extra</p>
        </div>
      </div>

      {/* Por empleado */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[16px] font-bold">Por empleado</h2>
        <button onClick={exportCSV}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[12.5px] font-semibold"
          style={{ background: "var(--purple-tint)", color: "var(--purple)" }}>
          <IconDownload className="w-3.5 h-3.5" /> Exportar CSV
        </button>
      </div>
      <div className="flex flex-col gap-2.5 mb-8">
        {stats.map((s) => (
          <div key={s.user.id} className="card px-5 py-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <Avatar name={s.user.display_name} color={s.user.nexus_color} size={36} />
                <div>
                  <p className="text-[14px] font-bold">{s.user.full_name}</p>
                  <p className="text-[11.5px]" style={{ color: "var(--text-3)" }}>{s.user.area}</p>
                </div>
              </div>
              <div className="flex gap-5 text-center">
                <div>
                  <p className="text-[15px] font-bold tabular-nums">{s.daysWorked}</p>
                  <p className="text-[9.5px] font-semibold" style={{ color: "var(--text-3)" }}>DÍAS</p>
                </div>
                <div>
                  <p className="text-[15px] font-bold tabular-nums">{fmtMin(s.totalMin)}</p>
                  <p className="text-[9.5px] font-semibold" style={{ color: "var(--text-3)" }}>TOTAL</p>
                </div>
                <div>
                  <p className="text-[15px] font-bold tabular-nums">{s.daysWorked ? fmtMin(s.avgMin) : "—"}</p>
                  <p className="text-[9.5px] font-semibold" style={{ color: "var(--text-3)" }}>PROMEDIO</p>
                </div>
                <div>
                  <p className="text-[15px] font-bold tabular-nums" style={{ color: s.extraMin > 0 ? "var(--ok)" : undefined }}>
                    {s.extraMin > 0 ? `+${fmtMin(s.extraMin)}` : "—"}
                  </p>
                  <p className="text-[9.5px] font-semibold" style={{ color: "var(--text-3)" }}>EXTRA</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Vacaciones aprobadas (solo lectura) */}
      <h2 className="text-[16px] font-bold mb-3">Vacaciones aprobadas</h2>
      {upcomingVacs.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="text-[13px]" style={{ color: "var(--text-2)" }}>Sin vacaciones próximas</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {upcomingVacs.map((v) => (
            <div key={v.id} className="card px-5 py-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar name={v.users?.display_name ?? "?"} color={v.users?.nexus_color} size={32} />
                <div>
                  <p className="text-[13.5px] font-bold">{v.users?.full_name}</p>
                  <p className="text-[12px]" style={{ color: "var(--text-2)" }}>
                    {v.start_date} → {v.end_date} · {v.days} días hábiles
                  </p>
                </div>
              </div>
              <Pill tone="ok">Aprobada</Pill>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
