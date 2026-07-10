"use client";
// ═══════════════════════════════════════════════════════════════
//  L2 · Asistencia — Vista del día (fusión del legado cert_nexus)
//  Toggle Tabla ⇄ Gantt diario por persona con línea "Ahora" viva.
//  Todo con tokens v6; datos 100 % Supabase (server page los junta).
// ═══════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from "react";
import { Avatar, Pill, SlidingSegments } from "@/components/ui";
import { PageHeader } from "@/components/shared";
import { fmtMin, fmtTime, stateAfter, TRABAJANDO } from "@/lib/hours";
import type { JornadaState } from "@/lib/hours";
import { nowMeridaMinutes } from "@/lib/tz";

export interface PersonDay {
  user: { id: string; display_name: string; area: string | null; nexus_color: string | null };
  schedule: { start_time: string; end_time: string; target_min: number };
  day: {
    firstIn: string | null; lastOut: string | null; totalMin: number;
    targetMin: number; metTarget: boolean; isOpen: boolean;
    movements: { id: string; type: "Entrada" | "Salida"; reason: string; time: string }[];
  };
}

/* ── Geometría del Gantt: eje 08:00 → 22:00 ── */
const AXIS_START = 8 * 60, AXIS_END = 22 * 60, AXIS_SPAN = AXIS_END - AXIS_START;
const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const pct = (min: number) => Math.min(100, Math.max(0, ((min - AXIS_START) / AXIS_SPAN) * 100));
const HOURS = Array.from({ length: (AXIS_END - AXIS_START) / 120 + 1 }, (_, i) => AXIS_START + i * 120); // cada 2 h

/** Segmentos presente/fuera a partir de los movimientos del día. */
function segmentsOf(day: PersonDay["day"], nowMin: number) {
  const segs: { from: number; to: number; kind: "presente" | "fuera" }[] = [];
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
    segs.push({ from, to, kind: cur.type === "Entrada" ? "presente" : "fuera" });
  }
  return segs;
}

function estadoPill(day: PersonDay["day"], states: JornadaState[]) {
  if (!day.firstIn) return <Pill tone="muted">Sin iniciar</Pill>;
  if (day.isOpen) {
    const last = day.movements.at(-1);
    const liveState = last ? stateAfter(last) : null;
    if (liveState && liveState !== TRABAJANDO) {
      return <Pill tone="warn">{liveState}</Pill>;
    }
    return <Pill tone="ok">Presente</Pill>;
  }
  return <Pill tone={day.metTarget ? "ok" : "warn"}>{day.metTarget ? "Completa" : "Cerrada"}</Pill>;
}

export default function AsistenciaClient({ people, states }: { people: PersonDay[]; states: JornadaState[] }) {
  const [view, setView] = useState<"tabla" | "gantt">("tabla");
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
        <SlidingSegments
          options={["Tabla", "Gantt"]}
          value={view === "tabla" ? "Tabla" : "Gantt"}
          onChange={(v) => setView(v === "Tabla" ? "tabla" : "gantt")}
        />
      </PageHeader>

      {view === "tabla" ? (
        /* ── Vista tabla (tarjetas por persona) ── */
        <div className="grid md:grid-cols-2 gap-4">
          {people.map(({ user: u, day }) => (
            <div key={u.id} className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Avatar name={u.display_name} color={u.nexus_color} size={38} />
                  <div>
                    <p className="text-[14.5px] font-bold">{u.display_name}</p>
                    <p className="text-[11.5px]" style={{ color: "var(--text-3)" }}>{u.area}</p>
                  </div>
                </div>
                {estadoPill(day, states)}
              </div>
              <div className="grid grid-cols-3 gap-2 text-center mb-3">
                {[
                  { v: fmtTime(day.firstIn), l: "ENTRADA" },
                  { v: day.firstIn ? fmtMin(day.totalMin) : "—", l: "LABORADO" },
                  { v: fmtMin(day.targetMin), l: "OBJETIVO" },
                ].map((c) => (
                  <div key={c.l} className="rounded-sm py-2.5" style={{ background: "var(--surface-2)" }}>
                    <p className="text-[14px] font-bold tabular-nums">{c.v}</p>
                    <p className="text-[9.5px] font-semibold" style={{ color: "var(--text-3)" }}>{c.l}</p>
                  </div>
                ))}
              </div>
              {day.movements.length > 0 && (
                <details>
                  <summary className="text-[12px] font-semibold cursor-pointer list-none" style={{ color: "var(--accent)" }}>
                    {day.movements.length} movimientos hoy →
                  </summary>
                  <div className="mt-2">
                    {day.movements.map((m) => (
                      <div key={m.id} className="flex justify-between py-1.5 text-[12.5px]"
                        style={{ borderBottom: "0.5px solid var(--border)" }}>
                        <span>{m.reason}</span>
                        <span className="font-semibold tabular-nums">{fmtTime(m.time)}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          ))}
        </div>
      ) : (
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
                      <Avatar name={u.display_name} color={u.nexus_color} size={30} />
                      <div className="min-w-0">
                        <p className="text-[12.5px] font-bold truncate">{u.display_name}</p>
                        <p className="text-[10px] tabular-nums" style={{ color: "var(--text-3)" }}>
                          {schedule.start_time.slice(0, 5)}–{schedule.end_time.slice(0, 5)}
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
                      {segs.map((s, i) => (
                        <div key={i}
                          className="absolute top-[5px] bottom-[5px] rounded-[6px]"
                          title={`${s.kind === "presente" ? "Presente" : "Fuera"} · ${String(Math.floor(s.from / 60)).padStart(2, "0")}:${String(s.from % 60).padStart(2, "0")}–${String(Math.floor(s.to / 60)).padStart(2, "0")}:${String(s.to % 60).padStart(2, "0")}`}
                          style={{
                            left: `${pct(s.from)}%`,
                            width: `${Math.max(0.6, pct(s.to) - pct(s.from))}%`,
                            background: s.kind === "presente"
                              ? "linear-gradient(155deg,#34D058,#2FB344)"
                              : "var(--warn-tint)",
                            border: s.kind === "fuera" ? "1px dashed var(--warn)" : "none",
                            boxShadow: s.kind === "presente" ? "0 2px 6px rgba(47,179,68,.3)" : "none",
                          }} />
                      ))}
                      {/* Marcadores de fichaje */}
                      {day.movements.map((m) => (
                        <div key={m.id} className="absolute top-0 bottom-0 w-px"
                          title={`${m.reason} · ${m.time.slice(0, 5)}`}
                          style={{ left: `${pct(toMin(m.time))}%`, background: "var(--border-2)" }} />
                      ))}
                    </div>
                    <div className="w-[86px] shrink-0 text-right">
                      <p className="text-[12px] font-bold tabular-nums">
                        {day.firstIn ? fmtMin(day.totalMin) : "—"}
                      </p>
                      <p className="text-[9.5px]" style={{ color: "var(--text-3)" }}>de {fmtMin(day.targetMin)}</p>
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
                <span className="inline-block w-3 h-2 rounded-[3px]" style={{ background: "var(--warn-tint)", border: "1px dashed var(--warn)" }} /> Fuera (comida/diligencia)
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
    </>
  );
}
