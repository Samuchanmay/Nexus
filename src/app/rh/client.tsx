"use client";
// RH · Solo lectura. RH ve horas laboradas y vacaciones aprobadas.
// NUNCA ve retardos ni faltas — no existen en Nexus.
import { useMemo, useState } from "react";
import { SlidingSegments, Avatar, Pill, SelectField } from "@/components/ui";
import { summarizeDay, fmtMin } from "@/lib/hours";
import type { JornadaState } from "@/lib/hours";
import type { AttendanceRow, Schedule, Vacation } from "@/lib/types";
import { IconDownload } from "@/components/icons";
import { todayMerida, addDays, shortDate, seniorityLabel, dmy, nextAnniversary } from "@/lib/tz";
import { VACATION_TONE } from "@/lib/ui-maps";

type Member = {
  id: string; full_name: string; display_name: string; nexus_color: string | null; area: string | null;
  vacation_balance: number; vacation_days_per_year: number; hire_date: string | null; vacation_balance_reset: string | null;
};

/** Semáforo de saldo — mismos umbrales que admin/vacaciones (verde <50%, amarillo 50-79%, rojo ≥80%). */
function balanceColor(pctUsed: number): string {
  return pctUsed < 50 ? "var(--ok)" : pctUsed < 80 ? "var(--warn)" : "var(--danger)";
}
function balanceLabel(pctUsed: number): string {
  return pctUsed < 50 ? "Disponible" : pctUsed < 80 ? "Moderado" : "Crítico";
}

const MESES_LARGO = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** Abre una ventana con un reporte individual autónomo (HTML + estilos embebidos) y lanza la
 * impresión — mismo patrón que imprimirReporteIndividual() del checador legado, sin depender del DOM. */
function printIndividualReport(m: Member, vacs: Vacation[]) {
  const total = m.vacation_days_per_year || 0;
  const used = Math.max(0, total - m.vacation_balance);
  const pctUsed = total > 0 ? Math.round((used / total) * 100) : 0;
  const mine = vacs.filter((v) => v.user_id === m.id && v.status !== "Rechazada").sort((a, b) => b.start_date.localeCompare(a.start_date));
  const rows = mine.map((v) =>
    `<tr><td>${dmy(v.start_date)} &rarr; ${dmy(v.end_date)}</td><td>${v.days} d&iacute;as</td><td>${v.status}</td></tr>`).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Reporte — ${m.full_name}</title>
    <style>
      body{font-family:-apple-system,Arial,sans-serif;color:#1D1D1F;margin:32px;}
      h1{font-size:20px;margin:0 0 4px}
      p.sub{color:#6E6E73;margin:0 0 24px;font-size:13px}
      .grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:28px}
      .box{border:1px solid #E5E7EB;border-radius:10px;padding:14px;text-align:center}
      .box b{display:block;font-size:22px}
      .box span{font-size:11px;color:#6E6E73;text-transform:uppercase;font-weight:600}
      table{width:100%;border-collapse:collapse;font-size:13px}
      th{text-align:left;color:#6E6E73;font-size:11px;text-transform:uppercase;padding:8px 6px;border-bottom:2px solid #E5E7EB}
      td{padding:8px 6px;border-bottom:1px solid #F1F5F9}
      @media print{ button{display:none} }
    </style></head><body>
    <h1>${m.full_name}</h1>
    <p class="sub">${m.area ?? ""}${seniorityLabel(m.hire_date) ? " · " + seniorityLabel(m.hire_date) + " de antigüedad" : ""}</p>
    <div class="grid">
      <div class="box"><b>${m.vacation_balance}</b><span>Disponibles</span></div>
      <div class="box"><b>${used}</b><span>Tomados</span></div>
      <div class="box"><b>${pctUsed}%</b><span>Usado</span></div>
    </div>
    <table><thead><tr><th>Periodo</th><th>D&iacute;as</th><th>Estado</th></tr></thead><tbody>${rows || '<tr><td colspan="3">Sin movimientos</td></tr>'}</tbody></table>
    <button onclick="window.print()" style="margin-top:24px;padding:10px 18px;border-radius:8px;border:none;background:#5856D6;color:#fff;font-weight:600;cursor:pointer">Guardar como PDF</button>
  </body></html>`;
  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); }
}

const MESES_CORTOS = MESES_LARGO;

/** Reporte HTML de TODOS los empleados — resumen + historial agrupado por mes,
 * mismo formato que el reporte del sistema legado de vacaciones (vacaciones.html). */
function printTeamReport(team: Member[], vacs: Vacation[]) {
  const today = todayMerida();
  const fechaLarga = `${Number(today.slice(8, 10))}/${Number(today.slice(5, 7))}/${today.slice(0, 4)}`;

  const resumenRows = team.map((m) => {
    const total = m.vacation_days_per_year || 0;
    const used = Math.max(0, total - m.vacation_balance);
    const pctUsed = total > 0 ? Math.round((used / total) * 100) : 0;
    const color = m.nexus_color || "#5856D6";
    const initial = (m.display_name || m.full_name || "?").charAt(0).toUpperCase();
    const estado = balanceLabel(pctUsed);
    const estadoBg = pctUsed < 50 ? "#D1FAE5" : pctUsed < 80 ? "#FEF3C7" : "#FEE2E2";
    const estadoFg = pctUsed < 50 ? "#065F46" : pctUsed < 80 ? "#92400E" : "#991B1B";
    return `<tr style="background:${color}14">
      <td style="padding:12px 14px"><span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:8px;background:${color};color:#fff;font-size:12px;font-weight:800;margin-right:8px;vertical-align:middle">${initial}</span><strong>${m.full_name}</strong></td>
      <td style="padding:12px 14px;text-align:center">${used}</td>
      <td style="padding:12px 14px;text-align:center;font-weight:800;color:${color}">${m.vacation_balance}</td>
      <td style="padding:12px 14px;text-align:center">${pctUsed}%</td>
      <td style="padding:12px 14px"><span style="background:${estadoBg};color:${estadoFg};padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700">${estado}</span></td>
      <td style="padding:12px 14px;color:#6B7280;font-size:13px">${m.hire_date ? dmy(nextAnniversary(m.hire_date)) : "—"}</td>
      <td style="padding:12px 14px;text-align:center">${total}</td>
    </tr>`;
  }).join("");

  const byMember = new Map(team.map((m) => [m.id, m]));
  const mine = vacs.filter((v) => v.status !== "Rechazada" && byMember.has(v.user_id)).sort((a, b) => b.start_date.localeCompare(a.start_date));
  const groups = new Map<string, Vacation[]>();
  for (const v of mine) {
    const key = `${MESES_CORTOS[Number(v.start_date.slice(5, 7)) - 1]} ${v.start_date.slice(0, 4)}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(v);
  }
  const historialRows = [...groups.entries()].map(([label, items]) => {
    const header = `<tr><td colspan="5" style="padding:10px 14px;background:#F1F5F9;font-size:11px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:.6px">${label}</td></tr>`;
    const rows = items.map((v) => {
      const m = byMember.get(v.user_id)!;
      const color = m.nexus_color || "#5856D6";
      const initial = (m.display_name || m.full_name || "?").charAt(0).toUpperCase();
      const estadoBg = v.status === "Aprobada" ? "#D1FAE5" : v.status === "Pendiente" ? "#FEF3C7" : "#FEE2E2";
      const estadoFg = v.status === "Aprobada" ? "#065F46" : v.status === "Pendiente" ? "#92400E" : "#991B1B";
      return `<tr style="background:${color}14">
        <td style="padding:11px 14px"><span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:6px;background:${color};color:#fff;font-size:10px;font-weight:800;margin-right:7px;vertical-align:middle">${initial}</span><strong>${m.full_name}</strong></td>
        <td style="padding:11px 14px;color:#374151">${dmy(v.start_date)}</td>
        <td style="padding:11px 14px;color:#374151">${dmy(v.end_date)}</td>
        <td style="padding:11px 14px;text-align:center;font-weight:800;color:${color}">${v.days}</td>
        <td style="padding:11px 14px"><span style="background:${estadoBg};color:${estadoFg};padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700">${v.status}</span></td>
      </tr>`;
    }).join("");
    return header + rows;
  }).join("");

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Reporte Vacaciones CERT ${fechaLarga}</title>
    <style>
      *{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#F3F4F6;margin:0;padding:24px;color:#111827}
      .wrap{max-width:860px;margin:0 auto}
      .header{background:linear-gradient(135deg,#1E293B,#334155);border-radius:16px;padding:28px 32px;margin-bottom:20px;color:#fff}
      .header h1{margin:0 0 4px;font-size:22px;font-weight:800}.header p{margin:0;color:#94A3B8;font-size:13px}
      .card{background:#fff;border-radius:14px;margin-bottom:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.07)}
      .card-titulo{padding:16px 18px;font-size:12px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:.7px;border-bottom:.5px solid #F1F5F9}
      table{width:100%;border-collapse:collapse}tr:last-child td{border-bottom:none}td{border-bottom:.5px solid #F1F5F9}
      th{padding:11px 14px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#fff;background:#1E293B}
      @media print{body{background:#fff;padding:0}.no-print{display:none}}
    </style></head><body><div class="wrap">
    <div class="header"><h1>Reporte de Vacaciones</h1><p>CERT Comunicación · Generado el ${fechaLarga}</p></div>
    <div class="no-print" style="text-align:right;margin-bottom:12px">
      <button onclick="window.print()" style="padding:10px 22px;background:#1E293B;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">Imprimir / Guardar PDF</button>
    </div>
    <div class="card"><div class="card-titulo">Resumen por empleado</div>
      <table><thead><tr><th>Empleado</th><th>Tomados</th><th>Restantes</th><th>%</th><th>Estado</th><th>Reinicio</th><th>Días/año</th></tr></thead>
      <tbody>${resumenRows || '<tr><td colspan="7" style="padding:14px">Sin personal registrado</td></tr>'}</tbody></table>
    </div>
    <div class="card"><div class="card-titulo">Historial de movimientos</div>
      <table><thead><tr><th>Empleado</th><th>Inicio</th><th>Fin</th><th>Días</th><th>Estado</th></tr></thead>
      <tbody>${historialRows || '<tr><td colspan="5" style="padding:14px">Sin movimientos</td></tr>'}</tbody></table>
    </div>
    </div></body></html>`;
  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); }
}

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

      {/* Vacaciones próximas (solo lectura) */}
      <h2 className="text-[16px] font-bold mb-3">Vacaciones próximas</h2>
      {upcomingVacs.length === 0 ? (
        <div className="card p-6 text-center mb-8">
          <p className="text-[13px]" style={{ color: "var(--text-2)" }}>Sin vacaciones próximas</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5 mb-8">
          {upcomingVacs.map((v) => (
            <div key={v.id} className="card px-5 py-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar name={v.users?.display_name ?? "?"} color={v.users?.nexus_color} size={32} />
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
              <Avatar name={m.display_name} color={m.nexus_color} size={34} />
              <div>
                <p className="text-[13.5px] font-bold">{m.full_name}</p>
                <p className="text-[11.5px]" style={{ color: "var(--text-3)" }}>
                  {seniorityLabel(m.hire_date) ?? m.area}
                  {m.hire_date && ` · reinicia ${shortDate(nextAnniversary(m.hire_date))}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-5 text-center">
              <div>
                <p className="text-[14px] font-bold tabular-nums">{used}</p>
                <p className="text-[9.5px] font-semibold" style={{ color: "var(--text-3)" }}>TOMADOS</p>
              </div>
              <div>
                <p className="text-[14px] font-bold tabular-nums" style={{ color: "var(--ok)" }}>{m.vacation_balance}</p>
                <p className="text-[9.5px] font-semibold" style={{ color: "var(--text-3)" }}>RESTANTES</p>
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
            <SelectField value={reportUserId} onChange={setReportUserId}>
              <option value="">Seleccionar empleado…</option>
              {team.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
            </SelectField>
          </div>
          <button
            className="btn-primary px-5 py-2.5 text-[13px]" disabled={!reportUserId}
            onClick={() => {
              const m = team.find((t) => t.id === reportUserId);
              if (m) printIndividualReport(m, vacations);
            }}>
            Reporte individual
          </button>
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap pt-3" style={{ borderTop: "1px solid var(--border)" }}>
          <p className="text-[12.5px]" style={{ color: "var(--text-2)" }}>
            Resumen y movimientos de todo el equipo, listo para imprimir o guardar como PDF.
          </p>
          <button
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-full text-[13px] font-semibold shrink-0"
            style={{ background: "var(--purple-tint)", color: "var(--purple)" }}
            onClick={() => printTeamReport(team, vacations)}>
            <IconDownload className="w-3.5 h-3.5" /> Reporte general (todos)
          </button>
        </div>
      </div>

      {/* Historial de movimientos */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-[16px] font-bold">Historial de movimientos</h2>
        <SelectField value={historyYear} onChange={setHistoryYear} className="w-[120px]">
          <option value="Todos">Todos</option>
          {historyYears.map((y) => <option key={y} value={y}>{y}</option>)}
        </SelectField>
      </div>
      {historyByMonth.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="text-[13px]" style={{ color: "var(--text-2)" }}>Sin movimientos registrados</p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {historyByMonth.map(([label, items]) => (
            <div key={label}>
              <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-3)" }}>{label}</p>
              <div className="flex flex-col gap-2">
                {items.map((v) => (
                  <div key={v.id} className="card px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <Avatar name={v.users?.display_name ?? "?"} color={v.users?.nexus_color} size={30} />
                      <div>
                        <p className="text-[13px] font-bold">{v.users?.full_name}</p>
                        <p className="text-[11.5px]" style={{ color: "var(--text-3)" }}>{dmy(v.start_date)} → {dmy(v.end_date)}</p>
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
