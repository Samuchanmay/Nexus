"use client";
// ═══════════════════════════════════════════════════════════════
//  L2 · Asistencia — Vista del día (fusión del legado cert_nexus)
//  Toggle Tabla ⇄ Gantt diario por persona con línea "Ahora" viva.
//  Todo con tokens v6; datos 100 % Supabase (server page los junta).
// ═══════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from "react";
import { Avatar, Pill, SlidingSegments, useToast } from "@/components/ui";
import { IconDownload } from "@/components/icons";
import { usePersistedView } from "@/lib/persisted-view";
import { PageHeader, Switch } from "@/components/shared";
import { createClient } from "@/lib/supabase/client";
import { fmtMin, fmtTime, stateAfter, TRABAJANDO } from "@/lib/hours";
import { resolvePresence } from "@/lib/status";
import { dmy } from "@/lib/tz";
import type { JornadaState } from "@/lib/hours";
import { nowMeridaMinutes } from "@/lib/tz";
import { isBirthdayToday, todayISO } from "@/lib/birthday";
import { logAdminAction } from "@/lib/admin-log";
import { XlsxWeeklyReportButton, type WeekBlock } from "./xlsx-weekly-report";

export interface PersonDay {
  user: {
    id: string; display_name: string; area: string | null; title?: string | null; nexus_color: string | null; avatar_url?: string | null; birth_date?: string | null;
    vacation?: { today: boolean; soonDays: number | null; startDate?: string | null; endDate?: string | null };
  };
  schedule: { start_time: string; end_time: string; target_min: number };
  day: {
    firstIn: string | null; lastOut: string | null; totalMin: number;
    targetMin: number; metTarget: boolean; isOpen: boolean; noRegistroSalida: boolean;
    movements: { id: string; type: "Entrada" | "Salida"; reason: string; time: string }[];
  };
}

export interface WeekRow {
  userId: string; name: string; week: string; totalMin: number; extraMin: number; days: number;
}

/* ── Geometría del Gantt: eje 08:00 → 22:00 ── */
const AXIS_START = 8 * 60, AXIS_END = 22 * 60, AXIS_SPAN = AXIS_END - AXIS_START;
const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const pct = (min: number) => Math.min(100, Math.max(0, ((min - AXIS_START) / AXIS_SPAN) * 100));
const HOURS = Array.from({ length: (AXIS_END - AXIS_START) / 120 + 1 }, (_, i) => AXIS_START + i * 120); // cada 2 h

/** Etiqueta corta del motivo de salida (para tooltip y badges de incidencias). */
const REASON_LABEL: Record<string, string> = {
  "Salida a comer": "Comida", "Salida a diligencia": "Diligencia",
  "Salida a cita médica": "Consulta médica", "Salida a permiso": "Permiso temporal",
  "Salida a pendientes": "Pendientes",
};

/** Segmentos presente/comida/fuera a partir de los movimientos del día — cada
    uno lleva su motivo textual para el tooltip del Gantt. */
function segmentsOf(day: PersonDay["day"], nowMin: number) {
  const segs: { from: number; to: number; kind: "presente" | "comida" | "fuera"; reason: string }[] = [];
  const mv = day.movements;
  for (let i = 0; i < mv.length; i++) {
    const cur = mv[i], next = mv[i + 1];
    const from = toMin(cur.time);
    const isLast = !next;
    const to = isLast
      ? (cur.type === "Entrada" || cur.reason !== "Fin de jornada" ? Math.max(from, Math.min(nowMin, AXIS_END)) : from)
      : toMin(next.time);
    if (cur.reason === "Fin de jornada") break;
    if (to <= from) continue;
    const kind = cur.type === "Entrada" ? "presente" : cur.reason === "Salida a comer" ? "comida" : "fuera";
    segs.push({ from, to, kind, reason: cur.type === "Entrada" ? "Presente" : (REASON_LABEL[cur.reason] ?? cur.reason) });
  }
  return segs;
}

/** Incidencias del día = salidas que no son comida (diligencia, cita médica,
    permiso, pendientes) — la comida es rutina, no una incidencia a vigilar. */
function incidentsOf(day: PersonDay["day"]) {
  return day.movements.filter((m) => m.type === "Salida" && m.reason !== "Fin de jornada" && m.reason !== "Salida a comer");
}

/** Minutos totales de comida del día (Salida a comer → siguiente Entrada). */
function mealMinutesOf(day: PersonDay["day"]) {
  const mv = day.movements;
  let total = 0;
  for (let i = 0; i < mv.length; i++) {
    if (mv[i].reason === "Salida a comer") {
      const next = mv[i + 1];
      if (next) total += toMin(next.time) - toMin(mv[i].time);
    }
  }
  return total;
}

type Vacation = { today: boolean; soonDays: number | null } | undefined;

/** Texto de "sale a vacaciones en N días" — singular/plural correcto. */
function soonLabel(days: number): string {
  if (days === 0) return "Vacaciones hoy";
  return `Vacaciones en ${days} día${days === 1 ? "" : "s"}`;
}

/** Estado unificado (lib/status.ts) + los matices propios de esta pantalla
    (Completa/Cerrada al día terminado, "por iniciar" cuando la vacación es
    en los próximos días). La vacación de HOY siempre pesa más que cualquier
    otra cosa — no tiene caso alertar por una jornada que no va a pasar. */
function estadoOf(day: PersonDay["day"], vacation?: Vacation): { color: string; label: string; tone: "ok" | "warn" | "muted" | "purple" | "danger" } {
  if (vacation?.today) return { color: "var(--purple)", label: "Vacaciones", tone: "purple" };
  if (!day.firstIn && vacation?.soonDays != null) return { color: "var(--purple)", label: soonLabel(vacation.soonDays), tone: "purple" };
  const last = day.movements.at(-1);
  const liveState = day.isOpen && last ? stateAfter(last) : null;
  const presence = resolvePresence({
    firstIn: day.firstIn, isOpen: day.isOpen, noRegistroSalida: day.noRegistroSalida,
    liveStateName: liveState, liveStateColor: null,
  });
  if (day.noRegistroSalida) return { color: presence.color, label: presence.label, tone: "danger" };
  if (!day.firstIn) return { color: presence.color, label: presence.label, tone: "muted" };
  if (day.isOpen) return { color: presence.color, label: presence.label, tone: presence.key === "trabajando" ? "ok" : "warn" };
  return day.metTarget ? { color: "var(--ok)", label: "Completa", tone: "ok" } : { color: "var(--warn)", label: "Cerrada", tone: "warn" };
}
function estadoPill(day: PersonDay["day"], states: JornadaState[], vacation?: Vacation) {
  const e = estadoOf(day, vacation);
  return <Pill tone={e.tone}>{e.label}</Pill>;
}
function estadoStatus(day: PersonDay["day"], vacation?: Vacation): { color: string; label: string } {
  return estadoOf(day, vacation);
}

export default function AsistenciaClient({ people, states, weekRows, weekBlocks, reportSettings, today, adminId }: {
  people: PersonDay[]; states: JornadaState[]; weekRows: WeekRow[]; weekBlocks: WeekBlock[];
  reportSettings: { enabled: boolean; email: string }; today: string; adminId: string;
}) {
  const toast = useToast();
  const [view, setView] = usePersistedView<"tabla" | "gantt" | "semana">(
    "asistencia.view", ["tabla", "gantt", "semana"], "tabla"
  );
  const [sending, setSending] = useState(false);
  const enviarReporte = async () => {
    setSending(true);
    const { data, error } = await createClient().functions.invoke("weekly-attendance-report", { body: { manual: true } });
    setSending(false);
    const ok = (data as { ok?: boolean } | null)?.ok;
    toast(!error && ok ? "Reporte semanal enviado por correo" : "No se pudo enviar el reporte", !error && ok ? "ok" : "danger");
    if (!error && ok && adminId) logAdminAction(createClient(), adminId, "Envió reporte semanal de asistencia");
  };
  const weekCsvHref = useMemo(() => {
    const csv = [
      "Semana (lunes),Persona,Días trabajados,Horas totales,Horas extra",
      ...weekRows.map((r) =>
        `${r.week},"${r.name}",${r.days},${(r.totalMin / 60).toFixed(1)},${(r.extraMin / 60).toFixed(1)}`),
    ].join("\n");
    return `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
  }, [weekRows]);
  const dayCsvHref = useMemo(() => {
    const csv = [
      "Persona,Puesto,Entrada,Horas laboradas,Objetivo",
      ...people.map(({ user: u, day }) =>
        `"${u.display_name}","${u.title ?? u.area ?? ""}",${fmtTime(day.firstIn)},${day.firstIn ? fmtMin(day.totalMin) : "—"},${fmtMin(day.targetMin)}`),
    ].join("\n");
    return `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
  }, [people]);

  // ── Switch de envío automático + correo destino (app_settings) ──
  const [reportEnabled, setReportEnabled] = useState(reportSettings.enabled);
  const [reportEmail, setReportEmail] = useState(reportSettings.email);
  const [savingSettings, setSavingSettings] = useState(false);
  const saveReportSettings = async (next: { enabled?: boolean; email?: string }) => {
    setSavingSettings(true);
    const enabled = next.enabled ?? reportEnabled;
    const email = next.email ?? reportEmail;
    const supabase = createClient();
    await Promise.all([
      supabase.from("app_settings").upsert({ key: "weekly_report_enabled", value: String(enabled) }),
      supabase.from("app_settings").upsert({ key: "weekly_report_email", value: email }),
    ]);
    setReportEnabled(enabled);
    setReportEmail(email);
    setSavingSettings(false);
    toast("Configuración del reporte guardada");
  };
  const [nowMin, setNowMin] = useState(() => nowMeridaMinutes());
  useEffect(() => {
    const id = setInterval(() => setNowMin(nowMeridaMinutes()), 30_000);
    return () => clearInterval(id);
  }, []);

  const nowLabel = useMemo(() => {
    const h = Math.floor(nowMin / 60), m = nowMin % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }, [nowMin]);
  const nowVisible = nowMin >= AXIS_START && nowMin <= AXIS_END;

  return (
    <>
      <PageHeader
        title="Asistencia"
        subtitle="Jornadas del equipo en tiempo real · la comida cuenta como tiempo laborado"
      >
        <div className="flex items-center gap-2.5 flex-wrap">
          <SlidingSegments
            options={["Tabla", "Gantt", "Semana"]}
            value={view === "tabla" ? "Tabla" : view === "gantt" ? "Gantt" : "Semana"}
            onChange={(v) => setView(v === "Tabla" ? "tabla" : v === "Gantt" ? "gantt" : "semana")}
          />
          <div className="w-full sm:w-[300px] flex justify-end">
            {view === "tabla" && (
              <a href={dayCsvHref} download={`asistencia-${today}.csv`}
                className="btn-secondary px-4 py-2.5 text-[13px] whitespace-nowrap flex items-center gap-1.5"
                onClick={() => { if (adminId) logAdminAction(createClient(), adminId, "Exportó reporte", `asistencia-${today}.csv`); }}>
                <IconDownload className="w-3.5 h-3.5" /> CSV del día
              </a>
            )}
            {view === "semana" && (
              <div className="flex items-center gap-2">
                <XlsxWeeklyReportButton blocks={weekBlocks} adminId={adminId} />
                <button className="btn-secondary px-4 py-2.5 text-[13px] whitespace-nowrap" disabled={sending} onClick={enviarReporte}>
                  {sending ? "Enviando…" : "Enviar ahora"}
                </button>
              </div>
            )}
          </div>
        </div>
      </PageHeader>

      {view === "semana" && (
        <div className="card p-4 mb-4 flex items-center gap-4 flex-wrap">
          <Switch tone="status" checked={reportEnabled} disabled={savingSettings}
            onChange={() => saveReportSettings({ enabled: !reportEnabled })}
            label={`Envío automático los lunes ${reportEnabled ? "activado" : "desactivado"}`} />
          <div className="flex items-center gap-2 flex-1 min-w-[220px]">
            <input
              className="field-input flex-1 text-[13px]" placeholder="correo@cert.edu.mx (deja vacío para el predeterminado)"
              value={reportEmail} onChange={(e) => setReportEmail(e.target.value)}
              onBlur={() => { if (reportEmail !== reportSettings.email) saveReportSettings({ email: reportEmail }); }}
            />
          </div>
          <p className="text-[11.5px] w-full" style={{ color: "var(--text-3)" }}>
            El botón &quot;Enviar ahora&quot; siempre funciona, sin importar este switch — el switch solo controla el envío automático de cada lunes.
          </p>
        </div>
      )}

      {view === "tabla" && (
        /* ── Vista tabla (tarjetas por persona) ── */
        <div className="grid md:grid-cols-2 gap-4">
          {people.map(({ user: u, day }) => (
            <div key={u.id} className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Avatar name={u.display_name} color={u.nexus_color} size={38} avatarUrl={u.avatar_url}
                    birthday={isBirthdayToday(u.birth_date, todayISO())}
                    status={estadoStatus(day, u.vacation).color} statusLabel={estadoStatus(day, u.vacation).label} />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-[14.5px] font-bold">{u.display_name}</p>
                      {incidentsOf(day).length > 0 && (
                        <span title={incidentsOf(day).map((m) => `${REASON_LABEL[m.reason] ?? m.reason} · ${fmtTime(m.time)}`).join(", ")}
                          className="px-1.5 py-[1px] rounded-full text-[10px] font-bold"
                          style={{ background: "var(--warn-tint)", color: "var(--warn)" }}>
                          {incidentsOf(day).length} {incidentsOf(day).length === 1 ? "incidencia" : "incidencias"}
                        </span>
                      )}
                    </div>
                    <p className="text-[11.5px]" style={{ color: "var(--text-3)" }}>{u.title ?? u.area}</p>
                  </div>
                </div>
                {estadoPill(day, states, u.vacation)}
              </div>
              {u.vacation?.today ? (
                <div className="flex items-center gap-2.5 rounded-m px-3.5 py-3" style={{ background: "var(--purple-tint)" }}>
                  <span style={{ color: "var(--purple)" }}>🏖</span>
                  <div>
                    <p className="text-[13.5px] font-bold" style={{ color: "var(--purple)" }}>Vacaciones</p>
                    {u.vacation.startDate && u.vacation.endDate && (
                      <p className="text-[12px]" style={{ color: "var(--text-2)" }}>{dmy(u.vacation.startDate)} → {dmy(u.vacation.endDate)}</p>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {(() => {
                    const pct = day.targetMin > 0 ? Math.min(100, Math.round((day.totalMin / day.targetMin) * 100)) : 0;
                    return (
                      <div className="mb-3">
                        <p className="text-[26px] font-bold tabular-nums leading-none">
                          {day.noRegistroSalida ? "—" : day.firstIn ? fmtMin(day.totalMin) : "—"}
                        </p>
                        <div className="mt-2.5">
                          <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 100 ? "var(--ok)" : "var(--accent)" }} />
                          </div>
                          <p className="text-[11px] font-semibold mt-1.5" style={{ color: "var(--text-3)" }}>
                            Objetivo {fmtMin(day.targetMin)}{day.firstIn ? ` · Entrada ${fmtTime(day.firstIn)}` : ""}
                            {!day.isOpen && day.lastOut ? ` · Salida ${fmtTime(day.lastOut)}` : ""}
                          </p>
                          <div className="flex items-center gap-2.5 mt-1 flex-wrap">
                            {day.totalMin > day.targetMin && (
                              <p className="text-[11px] font-semibold" style={{ color: "var(--ok)" }}>
                                +{fmtMin(day.totalMin - day.targetMin)} extra
                              </p>
                            )}
                            {mealMinutesOf(day) > 0 && (
                              <p className="text-[11px] font-semibold" style={{ color: "var(--text-3)" }}>
                                Comida {fmtMin(mealMinutesOf(day))}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                  {day.movements.length > 0 && (
                    <details className="group">
                      <summary className="text-[12px] font-semibold cursor-pointer list-none flex items-center gap-1 transition-colors hover:opacity-75" style={{ color: "var(--accent)" }}>
                        {day.movements.length} movimientos hoy
                        <span className="transition-transform group-open:rotate-90">→</span>
                      </summary>
                      <div className="mt-2">
                        {day.movements.map((m) => (
                          <div key={m.id} className="flex justify-between py-1.5 text-[12.5px] rounded-[4px] px-1.5 -mx-1.5 transition-colors hover:bg-hover"
                            style={{ borderBottom: "0.5px solid var(--border)" }}>
                            <span>{m.reason}</span>
                            <span className="font-semibold tabular-nums">{fmtTime(m.time)}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
      {view === "gantt" && (
        /* ── L2 · Gantt diario con línea "Ahora" ── */
        <div className="card p-5 overflow-x-auto">
          <div className="min-w-[640px]">
            {/* Eje de horas */}
            <div className="relative h-6 ml-[168px] mb-1">
              {HOURS.map((h) => (
                <span key={h} className="absolute -translate-x-1/2 text-[10.5px] font-semibold tabular-nums"
                  style={{ left: `${pct(h)}%`, color: "var(--text-3)" }}>
                  {String(h / 60).padStart(2, "0")}:00
                </span>
              ))}
            </div>

            <div className="relative">
              {/* Rejilla vertical */}
              <div className="absolute inset-0 ml-[168px] pointer-events-none">
                {HOURS.map((h) => (
                  <div key={h} className="absolute top-0 bottom-0 w-px"
                    style={{ left: `${pct(h)}%`, background: "var(--border)" }} />
                ))}
                {/* Línea "Ahora" */}
                {nowVisible && (
                  <div className="absolute -top-1 -bottom-1 z-10" style={{ left: `${pct(nowMin)}%` }}>
                    <div className="absolute top-0 bottom-0 w-[2px] -translate-x-1/2 rounded-full"
                      style={{ background: "var(--danger)", boxShadow: "0 0 8px rgba(255,59,48,.45)" }} />
                    <span className="absolute -top-0.5 left-1.5 text-[9.5px] font-bold px-1.5 py-0.5 rounded-full text-white whitespace-nowrap"
                      style={{ background: "var(--danger)" }}>
                      Ahora · {nowLabel}
                    </span>
                  </div>
                )}
              </div>

              {/* Filas por persona */}
              {people.map(({ user: u, schedule, day }) => {
                const segs = segmentsOf(day, nowMin);
                return (
                  <div key={u.id} className="flex items-center gap-3 py-2.5"
                    style={{ borderBottom: "0.5px solid var(--border)" }}>
                    <div className="flex items-center gap-2.5 w-[156px] shrink-0">
                      <Avatar name={u.display_name} color={u.nexus_color} size={30} avatarUrl={u.avatar_url} birthday={isBirthdayToday(u.birth_date, todayISO())} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <p className="text-[12.5px] font-bold truncate">{u.display_name}</p>
                          {incidentsOf(day).length > 0 && (
                            <span title={incidentsOf(day).map((m) => `${REASON_LABEL[m.reason] ?? m.reason} · ${fmtTime(m.time)}`).join(", ")}
                              className="px-1 rounded-full text-[9px] font-bold shrink-0"
                              style={{ background: "var(--warn-tint)", color: "var(--warn)" }}>
                              {incidentsOf(day).length}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] tabular-nums" style={{ color: "var(--text-3)" }}>
                          {fmtTime(schedule.start_time)}–{fmtTime(schedule.end_time)}
                        </p>
                      </div>
                    </div>
                    <div className="relative flex-1 h-8 rounded-[8px]" style={{ background: "var(--surface-2)" }}>
                      {/* Banda del horario objetivo */}
                      <div className="absolute top-0 bottom-0 rounded-[8px]"
                        style={{
                          left: `${pct(toMin(schedule.start_time))}%`,
                          width: `${pct(toMin(schedule.end_time)) - pct(toMin(schedule.start_time))}%`,
                          background: "var(--accent-tint)",
                          border: "1px dashed var(--border-2)",
                        }} />
                      {/* Segmentos reales */}
                      {segs.map((s, i) => {
                        const fromLabel = fmtTime(`${String(Math.floor(s.from / 60)).padStart(2, "0")}:${String(s.from % 60).padStart(2, "0")}`);
                        const toLabel = fmtTime(`${String(Math.floor(s.to / 60)).padStart(2, "0")}:${String(s.to % 60).padStart(2, "0")}`);
                        return (
                          <div key={i}
                            className="absolute top-[5px] bottom-[5px] rounded-[6px]"
                            title={`${s.reason} · ${fromLabel}–${toLabel} (${fmtMin(s.to - s.from)})`}
                            style={{
                              left: `${pct(s.from)}%`,
                              width: `${Math.max(0.6, pct(s.to) - pct(s.from))}%`,
                              background: s.kind === "presente"
                                ? "linear-gradient(155deg,#34D058,#2FB344)"
                                : s.kind === "comida" ? "var(--accent-tint)" : "var(--warn-tint)",
                              border: s.kind === "comida" ? "1px dashed var(--accent)"
                                : s.kind === "fuera" ? "1px dashed var(--warn)" : "none",
                              boxShadow: s.kind === "presente" ? "0 2px 6px rgba(47,179,68,.3)" : "none",
                            }} />
                        );
                      })}
                      {/* Marcadores de fichaje */}
                      {day.movements.map((m) => (
                        <div key={m.id} className="absolute top-0 bottom-0 w-px"
                          title={`${m.reason} · ${fmtTime(m.time)}`}
                          style={{ left: `${pct(toMin(m.time))}%`, background: "var(--border-2)" }} />
                      ))}
                    </div>
                    <div className="w-[86px] shrink-0 text-right">
                      <p className="text-[12px] font-bold tabular-nums">
                        {day.firstIn ? fmtMin(day.totalMin) : "—"}
                      </p>
                      <p className="text-[9.5px]" style={{ color: "var(--text-3)" }}>de {fmtMin(day.targetMin)}</p>
                      {day.totalMin > day.targetMin && (
                        <p className="text-[9.5px] font-semibold tabular-nums" style={{ color: "var(--ok)" }}>
                          +{fmtMin(day.totalMin - day.targetMin)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Leyenda */}
            <div className="flex items-center gap-4 mt-3 text-[10.5px] font-semibold" style={{ color: "var(--text-2)" }}>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-2 rounded-[3px]" style={{ background: "linear-gradient(155deg,#34D058,#2FB344)" }} /> Presente
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-2 rounded-[3px]" style={{ background: "var(--accent-tint)", border: "1px dashed var(--accent)" }} /> Comida
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-2 rounded-[3px]" style={{ background: "var(--warn-tint)", border: "1px dashed var(--warn)" }} /> Fuera (diligencia/permiso)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-2 rounded-[3px]" style={{ background: "var(--accent-tint)", border: "1px dashed var(--border-2)" }} /> Horario objetivo
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-[2px] h-3 rounded-full" style={{ background: "var(--danger)" }} /> Ahora
              </span>
            </div>
          </div>
        </div>
      )}
      {view === "semana" && (
        /* ── Desglose semanal por persona (equivalente al reporte del checador legado) ── */
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <p className="text-[12px] font-semibold" style={{ color: "var(--text-3)" }}>Últimas 8 semanas</p>
            <a href={weekCsvHref} download="asistencia-semanal.csv"
              className="flex items-center gap-1 text-[12px] font-semibold" style={{ color: "var(--accent)" }}
              onClick={() => { if (adminId) logAdminAction(createClient(), adminId, "Exportó reporte", "asistencia-semanal.csv"); }}>
              <IconDownload className="w-3 h-3" /> Exportar CSV
            </a>
          </div>
          {weekRows.length === 0 ? (
            <p className="text-[13px]" style={{ color: "var(--text-3)" }}>Sin registros en las últimas 8 semanas.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr style={{ color: "var(--text-3)" }} className="text-left">
                    <th className="font-semibold pb-2 pr-4">Semana</th>
                    <th className="font-semibold pb-2 pr-4">Persona</th>
                    <th className="font-semibold pb-2 pr-4">Días</th>
                    <th className="font-semibold pb-2 pr-4">Horas totales</th>
                    <th className="font-semibold pb-2">Extra</th>
                  </tr>
                </thead>
                <tbody>
                  {weekRows.map((r) => (
                    <tr key={`${r.userId}-${r.week}`} className="border-t transition-colors hover:bg-hover" style={{ borderColor: "var(--border)" }}>
                      <td className="py-2 pr-4 tabular-nums">{dmy(r.week)}</td>
                      <td className="py-2 pr-4 font-semibold">{r.name}</td>
                      <td className="py-2 pr-4 tabular-nums">{r.days}</td>
                      <td className="py-2 pr-4 tabular-nums">{fmtMin(r.totalMin)}</td>
                      <td className="py-2 tabular-nums" style={{ color: r.extraMin > 0 ? "var(--ok)" : "var(--text-3)" }}>
                        {r.extraMin > 0 ? `+${fmtMin(r.extraMin)}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
}
