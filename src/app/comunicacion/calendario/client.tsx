"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SlidingSegments } from "@/components/ui";
import { Icon } from "@/components/os/icons";
import { MONTHS, DOW, buildMonthGrid } from "@/lib/calendar-grid";
import { dmy, addDays } from "@/lib/tz";

const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DOW_LONG = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** Lun=0..Dom=6, para indexar en DOW/DOW_LONG que ya empiezan en lunes. */
function mondayIndex(iso: string) {
  return (new Date(`${iso}T12:00:00`).getDay() + 6) % 7;
}
function dayLongLabel(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dow = DOW_LONG[new Date(`${iso}T12:00:00`).getDay()];
  return `${dow.charAt(0).toUpperCase()}${dow.slice(1)} ${d} de ${MONTHS[m - 1]} ${y}`;
}
function weekRangeLabel(cells: { date: string }[]) {
  if (!cells.length) return "";
  const a = cells[0].date, b = cells[cells.length - 1].date;
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  if (am === bm && ay === by) return `${ad}–${bd} ${MONTHS_SHORT[am - 1]} ${ay}`;
  return `${ad} ${MONTHS_SHORT[am - 1]} – ${bd} ${MONTHS_SHORT[bm - 1]} ${by}`;
}

export type VacationRange = { start_date: string; end_date: string };
export type Deadline = { id: string; deadline: string | null; status: string; requests: { title: string; type: string } | null };
export type GcalEvent = { id: string; title: string; start: string; end: string; allDay: boolean };
export type NextActivity = { deadline: string; status: string; requests: { title: string } | null } | null;

/* ═══════════════════════════════════════════════════════════════
   Calendario personal — mismas tres vistas Día/Semana/Mes que
   admin/calendario (Plano Maestro — pedido explícito de que la
   granularidad aplique parejo en toda la app, no solo para el
   admin), sobre las fechas límite, vacaciones, días inhábiles y
   eventos de Google Calendar de UNA sola persona. Sin pestaña
   Equipo/Asistencia — eso es exclusivo del calendario de admin.
   ═══════════════════════════════════════════════════════════════ */
export default function CalendarioClient({
  ym, year, month, daysInMonth, today, prevHref, nextHref,
  vacations, holidays, deadlines, gcalEvents, gcalError, nextActivity, initialFocusDate,
}: {
  ym: string; year: number; month: number; daysInMonth: number; today: string;
  prevHref: string; nextHref: string;
  vacations: VacationRange[]; holidays: { date: string; name: string }[];
  deadlines: Deadline[]; gcalEvents?: GcalEvent[]; gcalError?: string | null;
  nextActivity?: NextActivity; initialFocusDate?: string;
}) {
  const router = useRouter();
  const [granularity, setGranularity] = useState<"Día" | "Semana" | "Mes">("Mes");
  const [focusDate, setFocusDate] = useState(initialFocusDate ?? today);

  const first = `${ym}-01`;
  const last = `${ym}-${String(daysInMonth).padStart(2, "0")}`;
  const holidayOf = useMemo(() => new Map(holidays.map((h) => [h.date, h.name])), [holidays]);
  const onVacation = (date: string) => vacations.some((v) => v.start_date <= date && v.end_date >= date);

  const monthCells = useMemo(() => buildMonthGrid(first, last, daysInMonth), [first, last, daysInMonth]);

  // Semana enfocada: monthCells ya viene en bloques completos de 7 (Lun–Dom),
  // así que la semana de cualquier fecha es simplemente el bloque que la contiene.
  const weekCells = useMemo(() => {
    for (let i = 0; i < monthCells.length; i += 7) {
      const chunk = monthCells.slice(i, i + 7);
      if (chunk.some((c) => c.date === focusDate)) return chunk;
    }
    return monthCells.slice(0, 7);
  }, [monthCells, focusDate]);

  /** Navega Prev/Hoy/Next respetando la granularidad — si la nueva fecha cae
      en otro mes, recarga la página con ?m=&d= (el fetch del server es por
      mes); si sigue en el mismo mes, solo mueve el estado local. */
  const shiftFocus = (dir: 1 | -1) => {
    const delta = granularity === "Día" ? 1 : 7;
    const newDate = addDays(focusDate, dir * delta);
    const newYm = newDate.slice(0, 7);
    if (newYm !== ym) router.push(`/comunicacion/calendario?m=${newYm}&d=${newDate}`);
    else setFocusDate(newDate);
  };
  const goToday = () => {
    const newYm = today.slice(0, 7);
    if (newYm !== ym) router.push(`/comunicacion/calendario?m=${newYm}&d=${today}`);
    else setFocusDate(today);
  };

  const deadlinesByDate = useMemo(() => {
    const m = new Map<string, Deadline[]>();
    for (const p of deadlines) {
      if (!p.deadline || p.deadline < first || p.deadline > last) continue;
      if (p.status === "cancelada" || p.status === "rechazada") continue;
      const list = m.get(p.deadline) ?? [];
      list.push(p);
      m.set(p.deadline, list);
    }
    return m;
  }, [deadlines, first, last]);

  // Eventos ya agendados en Google Calendar ("Eventos CERT") — incluye los
  // creados directamente en Google, no solo los que nacieron en Nexus.
  const gcalByDate = useMemo(() => {
    const m = new Map<string, GcalEvent[]>();
    for (const ev of gcalEvents ?? []) {
      const d0 = new Date(`${ev.start}T12:00:00`);
      const dEnd = new Date(`${ev.end}T12:00:00`);
      if (!ev.allDay) dEnd.setDate(dEnd.getDate() + 1);
      const d = new Date(d0);
      let guard = 0;
      while (d < dEnd && guard < 60) {
        const iso = d.toISOString().slice(0, 10);
        if (iso >= first && iso <= last) {
          const list = m.get(iso) ?? [];
          list.push(ev);
          m.set(iso, list);
        }
        d.setDate(d.getDate() + 1);
        guard++;
      }
    }
    return m;
  }, [gcalEvents, first, last]);

  return (
    <>
      <header className="pt-8 pb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight capitalize">
            {granularity === "Mes" ? `${MONTHS[month - 1]} ${year}`
              : granularity === "Semana" ? weekRangeLabel(weekCells)
              : dayLongLabel(focusDate)}
          </h1>
          <p className="text-[13.5px] mt-1" style={{ color: "var(--text-2)" }}>
            Tus fechas límite, vacaciones y días inhábiles
          </p>
        </div>
        <div className="flex items-center gap-2">
          {granularity === "Mes" ? (
            <>
              <Link href={prevHref} className="btn-secondary px-3.5 py-2 text-[13px]">←</Link>
              <Link href="/comunicacion/calendario" className="btn-secondary px-3.5 py-2 text-[13px]">Hoy</Link>
              <Link href={nextHref} className="btn-secondary px-3.5 py-2 text-[13px]">→</Link>
            </>
          ) : (
            <>
              <button onClick={() => shiftFocus(-1)} className="btn-secondary px-3.5 py-2 text-[13px]">←</button>
              <button onClick={goToday} className="btn-secondary px-3.5 py-2 text-[13px]">Hoy</button>
              <button onClick={() => shiftFocus(1)} className="btn-secondary px-3.5 py-2 text-[13px]">→</button>
            </>
          )}
        </div>
      </header>

      {nextActivity && (nextActivity.deadline < first || nextActivity.deadline > last) && (
        <Link href={`/comunicacion/calendario?m=${nextActivity.deadline.slice(0, 7)}&d=${nextActivity.deadline}`}
          className="card p-4 mb-4 flex items-center justify-between gap-3 hover:bg-hover transition-colors">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--text-3)" }}>Tu próxima actividad</p>
            <p className="text-[13.5px] font-semibold truncate mt-0.5">{nextActivity.requests?.title ?? "Actividad"}</p>
          </div>
          <span className="text-[12.5px] font-bold shrink-0" style={{ color: "var(--accent)" }}>
            {dmy(nextActivity.deadline)} →
          </span>
        </Link>
      )}

      {gcalError && (
        <div className="card px-4 py-2.5 mb-4 flex items-center gap-2 text-[12.5px]"
          style={{ background: "var(--warn-tint)", color: "var(--warn)" }}>
          <Icon name="alert" size={14} aria-hidden />
          <span>No se pudieron cargar los eventos de Google Calendar — {gcalError}</span>
        </div>
      )}

      <div className="mb-4">
        <SlidingSegments options={["Día", "Semana", "Mes"]} value={granularity}
          onChange={(v) => setGranularity(v as typeof granularity)} />
      </div>

      {granularity === "Mes" && (
        <div className="card p-4 overflow-x-auto">
          <div className="min-w-[640px]">
          <div className="grid grid-cols-7 gap-1.5 mb-2">
            {DOW.map((d) => <p key={d} className="text-center text-[11px] font-bold" style={{ color: "var(--text-3)" }}>{d}</p>)}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {monthCells.map((c) => {
              const acts = deadlinesByDate.get(c.date) ?? [];
              const gevs = gcalByDate.get(c.date) ?? [];
              const vac = onVacation(c.date);
              return (
                <div key={c.date} className="rounded-sm p-1.5 min-h-[80px] flex flex-col gap-1"
                  style={{
                    background: vac ? "var(--purple-tint)" : holidayOf.get(c.date) ? "var(--accent-tint)" : "var(--surface-2)",
                    opacity: c.inMonth ? 1 : 0.35,
                    outline: c.date === today ? "2px solid var(--accent)" : undefined,
                    outlineOffset: "-2px",
                  }}>
                  <p className="text-[11.5px] font-bold tabular-nums" style={{ color: "var(--text-2)" }}>{c.day}</p>
                  {holidayOf.get(c.date) && <p className="text-[9.5px] font-semibold truncate" style={{ color: "var(--accent)" }}>{holidayOf.get(c.date)}</p>}
                  {vac && <p className="text-[9.5px] font-semibold" style={{ color: "var(--purple)" }}>Vacaciones</p>}

                  {acts.slice(0, 2).map((p) => (
                    <p key={p.id} className="text-[9.5px] font-semibold truncate px-1 py-0.5 rounded-[4px]"
                      style={{ background: "var(--warn-tint)", color: "var(--warn)" }} title={p.requests?.title ?? "Actividad"}>
                      {p.requests?.title ?? "Actividad"}
                    </p>
                  ))}
                  {acts.length > 2 && (
                    <p className="text-[9px] font-semibold" style={{ color: "var(--warn)" }}>+{acts.length - 2} actividad{acts.length - 2 > 1 ? "es" : ""}</p>
                  )}

                  {gevs.slice(0, 2).map((ev) => (
                    <p key={ev.id} className="text-[9.5px] font-semibold truncate px-1 py-0.5 rounded-[4px]"
                      style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
                      title={`${ev.title} · Eventos CERT (Google Calendar)`}>
                      {ev.title}
                    </p>
                  ))}
                  {gevs.length > 2 && (
                    <p className="text-[9px] font-semibold" style={{ color: "var(--accent)" }}>
                      +{gevs.length - 2} evento{gevs.length - 2 > 1 ? "s" : ""}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3.5 text-[10.5px] font-semibold" style={{ color: "var(--text-2)" }}>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3.5 h-3 rounded-[4px]" style={{ background: "var(--warn-tint)" }} /> Tu actividad
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3.5 h-3 rounded-[4px]" style={{ background: "var(--accent-tint)" }} /> Evento (Google Calendar)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3.5 h-3 rounded-full" style={{ background: "var(--purple)" }} /> Vacaciones
            </span>
          </div>
          </div>
        </div>
      )}

      {granularity === "Semana" && (
        <div className="card p-4">
          <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
            {weekCells.map((c) => {
              const acts = deadlinesByDate.get(c.date) ?? [];
              const gevs = gcalByDate.get(c.date) ?? [];
              const vac = onVacation(c.date);
              const empty = acts.length === 0 && gevs.length === 0 && !vac && !holidayOf.get(c.date);
              return (
                <div key={c.date} className="rounded-sm p-2.5 flex flex-col gap-1.5 min-h-[110px]"
                  style={{
                    background: vac ? "var(--purple-tint)" : holidayOf.get(c.date) ? "var(--accent-tint)" : "var(--surface-2)",
                    outline: c.date === today ? "2px solid var(--accent)" : undefined,
                    outlineOffset: "-2px",
                  }}>
                  <div className="flex items-center justify-between">
                    <p className="text-[10.5px] font-bold uppercase tracking-wide" style={{ color: "var(--text-3)" }}>{DOW[mondayIndex(c.date)]}</p>
                    <p className="text-[13px] font-bold tabular-nums" style={{ color: "var(--text-2)" }}>{c.day}</p>
                  </div>
                  {holidayOf.get(c.date) && <p className="text-[10px] font-semibold" style={{ color: "var(--accent)" }}>{holidayOf.get(c.date)}</p>}
                  {vac && <p className="text-[10px] font-semibold" style={{ color: "var(--purple)" }}>Vacaciones</p>}

                  {acts.map((p) => (
                    <p key={p.id} className="text-[10.5px] font-semibold px-1.5 py-1 rounded-[4px]"
                      style={{ background: "var(--warn-tint)", color: "var(--warn)" }}>
                      {p.requests?.title ?? "Actividad"}
                    </p>
                  ))}

                  {gevs.map((ev) => (
                    <p key={ev.id} className="text-[10.5px] font-semibold px-1.5 py-1 rounded-[4px]"
                      style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
                      title="Eventos CERT (Google Calendar)">
                      {ev.title}
                    </p>
                  ))}

                  {empty && <p className="text-[10px] mt-auto" style={{ color: "var(--text-3)" }}>Sin eventos</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {granularity === "Día" && (() => {
        const acts = deadlinesByDate.get(focusDate) ?? [];
        const gevs = gcalByDate.get(focusDate) ?? [];
        const vac = onVacation(focusDate);
        const holiday = holidayOf.get(focusDate);
        const empty = acts.length === 0 && gevs.length === 0 && !vac && !holiday;
        return (
          <div className="card p-5 flex flex-col gap-3">
            {holiday && (
              <div className="flex items-center gap-3 px-3.5 py-3 rounded-sm" style={{ background: "var(--accent-tint)" }}>
                <Icon name="calendar" size={16} style={{ color: "var(--accent)" }} />
                <p className="text-[13.5px] font-bold" style={{ color: "var(--accent)" }}>{holiday} · Día inhábil</p>
              </div>
            )}
            {vac && (
              <div className="flex items-center gap-3 px-3.5 py-3 rounded-sm" style={{ background: "var(--purple-tint)" }}>
                <Icon name="plane" size={16} style={{ color: "var(--purple)" }} />
                <p className="text-[13.5px] font-bold" style={{ color: "var(--purple)" }}>Estás de vacaciones</p>
              </div>
            )}
            {acts.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-3.5 py-3 rounded-sm" style={{ background: "var(--warn-tint)" }}>
                <Icon name="flag" size={16} style={{ color: "var(--warn)" }} />
                <p className="text-[13.5px] font-bold truncate" style={{ color: "var(--warn)" }}>{p.requests?.title ?? "Actividad"}</p>
              </div>
            ))}
            {gevs.map((ev) => (
              <div key={ev.id} className="flex items-center gap-3 px-3.5 py-3 rounded-sm" style={{ background: "var(--accent-tint)" }}>
                <Icon name="calendar" size={16} style={{ color: "var(--accent)" }} />
                <p className="text-[13.5px] font-bold" style={{ color: "var(--accent)" }}>{ev.title}</p>
              </div>
            ))}
            {empty && (
              <p className="text-[13px] py-6 text-center" style={{ color: "var(--text-3)" }}>
                Sin actividades, eventos ni vacaciones registradas para este día.
              </p>
            )}
          </div>
        );
      })()}

      {holidays.length > 0 && (
        <div className="card p-5 mt-4">
          <h2 className="text-[15px] font-bold mb-2.5">Días inhábiles de {MONTHS[month - 1]}</h2>
          <div className="flex flex-col gap-1.5">
            {holidays.map((h) => (
              <div key={h.date} className="flex items-center justify-between text-[13px]">
                <span className="font-semibold">{h.name}</span>
                <span className="tabular-nums" style={{ color: "var(--text-3)" }}>{dmy(h.date)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
