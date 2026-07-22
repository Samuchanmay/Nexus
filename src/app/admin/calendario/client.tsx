"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar, SlidingSegments } from "@/components/ui";
import { Icon } from "@/components/os/icons";
import { MONTHS, DOW, buildMonthGrid } from "@/lib/calendar-grid";
import { isBirthdayToday, todayISO } from "@/lib/birthday";
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

export type TeamMember = { id: string; display_name: string; nexus_color: string | null; avatar_url?: string | null; birth_date?: string | null };
export type VacationRange = { user_id: string; start_date: string; end_date: string };
export type ProjectDeadline = {
  id: string; deadline: string; status: string;
  requests: { title: string; type: string } | null;
  project_assignments: { is_lead: boolean; users: { display_name: string; nexus_color: string | null } }[];
};

export type GcalEvent = { id: string; title: string; start: string; end: string; allDay: boolean };

export default function CalendarioClient({
  ym, year, month, daysInMonth, today, prevHref, nextHref,
  team, attendance, vacations, holidays, deadlines, efemerides, gcalEvents, gcalError,
  initialFocusDate,
}: {
  ym: string; year: number; month: number; daysInMonth: number; today: string;
  prevHref: string; nextHref: string;
  team: TeamMember[]; attendance: { user_id: string; date: string }[];
  vacations: VacationRange[]; holidays: { date: string; name: string }[];
  deadlines: ProjectDeadline[]; efemerides?: string[]; gcalEvents?: GcalEvent[];
  gcalError?: string | null;
  initialFocusDate?: string;
}) {
  const router = useRouter();
  const [view, setView] = useState<"Asistencia" | "Equipo">("Equipo");
  // Granularidad Día/Semana/Mes (Plano Maestro — pedido explícito: "que haya
  // la opción de poner día, semana o mes"). focusDate es la fecha "activa"
  // para Día/Semana; en Mes no se usa para la rejilla pero sí para saber
  // qué semana mostrar si se cambia a Semana desde un día cualquiera.
  const [granularity, setGranularity] = useState<"Día" | "Semana" | "Mes">("Mes");
  const [focusDate, setFocusDate] = useState(initialFocusDate ?? today);

  const first = `${ym}-01`;
  const last = `${ym}-${String(daysInMonth).padStart(2, "0")}`;
  const holidayOf = useMemo(() => new Map(holidays.map((h) => [h.date, h.name])), [holidays]);
  const attSet = useMemo(() => new Set(attendance.map((a) => `${a.user_id}|${a.date}`)), [attendance]);

  const days = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => {
    const d = String(i + 1).padStart(2, "0");
    const date = `${ym}-${d}`;
    const dow = new Date(`${date}T12:00:00`).getDay();
    return { n: i + 1, date, isWeekend: dow === 0 || dow === 6, holiday: holidayOf.get(date) ?? null };
  }), [daysInMonth, ym, holidayOf]);

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

  // Días visibles en el heatmap de Asistencia según granularidad — los de
  // Semana/Día que caen fuera del mes actual no tienen datos (el fetch del
  // servidor es por mes), así que se recortan a los que sí están dentro.
  const attendanceDays = useMemo(() => {
    if (granularity === "Mes") return days;
    if (granularity === "Día") return days.filter((d) => d.date === focusDate);
    const weekDates = new Set(weekCells.map((c) => c.date));
    return days.filter((d) => weekDates.has(d.date));
  }, [granularity, days, focusDate, weekCells]);

  /** Navega Prev/Hoy/Next respetando la granularidad — si la nueva fecha cae
      en otro mes, recarga la página con ?m=&d= (el fetch del server es por
      mes); si sigue en el mismo mes, solo mueve el estado local. */
  const shiftFocus = (dir: 1 | -1) => {
    const delta = granularity === "Día" ? 1 : 7;
    const newDate = addDays(focusDate, dir * delta);
    const newYm = newDate.slice(0, 7);
    if (newYm !== ym) router.push(`/admin/calendario?m=${newYm}&d=${newDate}`);
    else setFocusDate(newDate);
  };
  const goToday = () => {
    const newYm = today.slice(0, 7);
    if (newYm !== ym) router.push(`/admin/calendario?m=${newYm}&d=${today}`);
    else setFocusDate(today);
  };

  type Cell = { kind: "fichaje" | "vacacion" | "inhabil" | "sin" | "off" | "futuro"; tip: string };
  const grid = useMemo(() => team.map((u) => {
    const cells: Cell[] = attendanceDays.map((d) => {
      const onVac = vacations.some((v) => v.user_id === u.id && v.start_date <= d.date && v.end_date >= d.date);
      if (onVac) return { kind: "vacacion", tip: `${dmy(d.date)} · Vacaciones` };
      if (d.holiday) return { kind: "inhabil", tip: `${dmy(d.date)} · ${d.holiday}` };
      if (d.isWeekend) return { kind: "off", tip: `${dmy(d.date)} · Fin de semana` };
      if (attSet.has(`${u.id}|${d.date}`)) return { kind: "fichaje", tip: `${dmy(d.date)} · Con registro` };
      if (d.date > today) return { kind: "futuro", tip: dmy(d.date) };
      return { kind: "sin", tip: `${dmy(d.date)} · Sin registro (informativo)` };
    });
    const habiles = cells.filter((c) => c.kind === "fichaje" || c.kind === "sin").length;
    const conRegistro = cells.filter((c) => c.kind === "fichaje").length;
    return { user: u, cells, habiles, conRegistro };
  }), [team, attendanceDays, vacations, attSet, today]);

  const CELL: Record<Cell["kind"], { bg: string; border?: string }> = {
    fichaje:  { bg: "linear-gradient(155deg,#34D058,#2FB344)" },
    vacacion: { bg: "linear-gradient(155deg,#A78BFA,#8E5CF7)" },
    inhabil:  { bg: "var(--accent-tint)", border: "1px solid var(--accent)" },
    sin:      { bg: "var(--warn-tint)", border: "1px dashed var(--warn)" },
    off:      { bg: "var(--surface-2)" },
    futuro:   { bg: "transparent", border: "1px dashed var(--border)" },
  };

  const deadlinesByDate = useMemo(() => {
    const m = new Map<string, ProjectDeadline[]>();
    for (const p of deadlines) {
      if (p.status === "cancelada") continue;
      const list = m.get(p.deadline) ?? [];
      list.push(p);
      m.set(p.deadline, list);
    }
    return m;
  }, [deadlines]);

  const vacationsByDate = useMemo(() => {
    const m = new Map<string, TeamMember[]>();
    for (const c of monthCells) {
      const people = team.filter((u) => vacations.some((v) => v.user_id === u.id && v.start_date <= c.date && v.end_date >= c.date));
      if (people.length) m.set(c.date, people);
    }
    return m;
  }, [monthCells, team, vacations]);

  // Eventos ya agendados en Google Calendar ("Eventos CERT") — incluye los
  // creados directamente en Google, no solo los que nacieron en Nexus.
  // Para eventos de todo el día, "end" viene exclusivo (estándar de Google
  // Calendar); para eventos con hora tratamos start=end como un solo día.
  const gcalByDate = useMemo(() => {
    const m = new Map<string, GcalEvent[]>();
    for (const ev of gcalEvents ?? []) {
      const d0 = new Date(`${ev.start}T12:00:00`);
      const dEnd = new Date(`${ev.allDay ? ev.end : ev.end}T12:00:00`);
      if (!ev.allDay) dEnd.setDate(dEnd.getDate() + 1); // incluir el día del evento
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
            Calendario del equipo · asistencia, actividades y vacaciones
          </p>
        </div>
        <div className="flex items-center gap-2">
          {granularity === "Mes" ? (
            <>
              <Link href={prevHref} className="btn-secondary px-3.5 py-2 text-[13px]">←</Link>
              <Link href="/admin/calendario" className="btn-secondary px-3.5 py-2 text-[13px]">Hoy</Link>
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

      {efemerides && efemerides.length > 0 && (
        <div className="card px-4 py-2.5 mb-4 flex items-center gap-2 text-[12.5px]" style={{ color: "var(--text-2)" }}>
          <Icon name="calendar" size={14} aria-hidden />
          <span>Hoy también es: <strong>{efemerides.join(" · ")}</strong></span>
        </div>
      )}

      {gcalError && (
        <div className="card px-4 py-2.5 mb-4 flex items-center gap-2 text-[12.5px]"
          style={{ background: "var(--warn-tint)", color: "var(--warn)" }}>
          <Icon name="alert" size={14} aria-hidden />
          <span>No se pudieron cargar los eventos de Google Calendar — {gcalError}</span>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <SlidingSegments options={["Equipo", "Asistencia"]} value={view} onChange={(v) => setView(v as typeof view)} />
        <SlidingSegments options={["Día", "Semana", "Mes"]} value={granularity}
          onChange={(v) => setGranularity(v as typeof granularity)} />
      </div>

      {view === "Asistencia" && (
        <div className="card p-5 overflow-x-auto">
          <div className={granularity === "Mes" ? "min-w-[720px]" : "min-w-0"}>
            <div className="flex items-center gap-3 pb-2" style={{ borderBottom: "0.5px solid var(--border)" }}>
              <div className="w-[150px] shrink-0" />
              <div className="flex-1 grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${attendanceDays.length}, minmax(0,1fr))` }}>
                {attendanceDays.map((d) => (
                  <span key={d.n}
                    className="text-center text-[9px] font-bold tabular-nums"
                    style={{ color: d.date === today ? "var(--accent)" : d.isWeekend ? "var(--text-3)" : "var(--text-2)" }}>
                    {d.n}
                  </span>
                ))}
              </div>
              <div className="w-[70px] shrink-0" />
            </div>

            {grid.map(({ user: u, cells, habiles, conRegistro }) => (
              <div key={u.id} className="flex items-center gap-3 py-2.5"
                style={{ borderBottom: "0.5px solid var(--border)" }}>
                <div className="flex items-center gap-2.5 w-[150px] shrink-0">
                  <Avatar name={u.display_name} color={u.nexus_color} size={28} avatarUrl={u.avatar_url} birthday={isBirthdayToday(u.birth_date, todayISO())} />
                  <p className="text-[12.5px] font-bold truncate">{u.display_name}</p>
                </div>
                <div className="flex-1 grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${attendanceDays.length}, minmax(0,1fr))` }}>
                  {cells.map((c, i) => (
                    <div key={i} title={c.tip}
                      className="h-5 rounded-[4px]"
                      style={{
                        background: CELL[c.kind].bg,
                        border: CELL[c.kind].border,
                        outline: attendanceDays[i].date === today ? "2px solid var(--accent)" : undefined,
                        outlineOffset: attendanceDays[i].date === today ? "1px" : undefined,
                      }} />
                  ))}
                </div>
                <div className="w-[70px] shrink-0 text-right">
                  <p className="text-[12px] font-bold tabular-nums">{conRegistro}/{habiles}</p>
                  <p className="text-[9px]" style={{ color: "var(--text-3)" }}>días reg.</p>
                </div>
              </div>
            ))}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3.5 text-[10.5px] font-semibold" style={{ color: "var(--text-2)" }}>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3.5 h-3 rounded-[3px]" style={{ background: CELL.fichaje.bg }} /> Con registro
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3.5 h-3 rounded-[3px]" style={{ background: CELL.vacacion.bg }} /> Vacaciones
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3.5 h-3 rounded-[3px]" style={{ background: CELL.inhabil.bg, border: CELL.inhabil.border }} /> Día inhábil
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3.5 h-3 rounded-[3px]" style={{ background: CELL.sin.bg, border: CELL.sin.border }} /> Sin registro (informativo)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3.5 h-3 rounded-[3px]" style={{ background: CELL.off.bg }} /> Fin de semana
              </span>
            </div>
          </div>
        </div>
      )}

      {view === "Equipo" && granularity === "Mes" && (
        <div className="card p-4 overflow-x-auto">
          <div className="min-w-[640px]">
          <div className="grid grid-cols-7 gap-1.5 mb-2">
            {DOW.map((d) => <p key={d} className="text-center text-[11px] font-bold" style={{ color: "var(--text-3)" }}>{d}</p>)}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {monthCells.map((c) => {
              const acts = deadlinesByDate.get(c.date) ?? [];
              const gevs = gcalByDate.get(c.date) ?? [];
              const people = vacationsByDate.get(c.date) ?? [];
              return (
                <div key={c.date} className="rounded-sm p-1.5 min-h-[96px] flex flex-col gap-1"
                  style={{
                    background: people.length ? "var(--purple-tint)" : holidayOf.get(c.date) ? "var(--accent-tint)" : "var(--surface-2)",
                    opacity: c.inMonth ? 1 : 0.35,
                    outline: c.date === today ? "2px solid var(--accent)" : undefined,
                    outlineOffset: "-2px",
                  }}>
                  <p className="text-[11.5px] font-bold tabular-nums" style={{ color: "var(--text-2)" }}>{c.day}</p>
                  {holidayOf.get(c.date) && <p className="text-[9.5px] font-semibold truncate" style={{ color: "var(--accent)" }}>{holidayOf.get(c.date)}</p>}

                  {acts.slice(0, 2).map((p) => {
                    const lead = p.project_assignments.find((a) => a.is_lead) ?? p.project_assignments[0];
                    return (
                      <p key={p.id} className="text-[9.5px] font-semibold truncate px-1 py-0.5 rounded-[4px]"
                        style={{ background: "var(--warn-tint)", color: "var(--warn)" }}
                        title={`${p.requests?.title ?? "Actividad"}${lead ? " · " + lead.users.display_name : ""}`}>
                        {p.requests?.title ?? "Actividad"}
                      </p>
                    );
                  })}
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
                    <p className="text-[9px] font-semibold" style={{ color: "var(--accent)" }}>+{gevs.length - 2} evento{gevs.length - 2 > 1 ? "s" : ""}</p>
                  )}

                  {people.length > 0 && (
                    <div className="flex -space-x-1.5 mt-auto pt-1 flex-wrap gap-y-1">
                      {people.slice(0, 4).map((u) => (
                        <div key={u.id} title={`${u.display_name} · Vacaciones`} style={{ border: "1.5px solid var(--surface-2)", borderRadius: "100px" }}>
                          <Avatar name={u.display_name} color={u.nexus_color} size={18} avatarUrl={u.avatar_url} birthday={isBirthdayToday(u.birth_date, todayISO())} />
                        </div>
                      ))}
                      {people.length > 4 && (
                        <span className="text-[9px] font-semibold ml-1" style={{ color: "var(--purple)" }}>+{people.length - 4}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3.5 text-[10.5px] font-semibold" style={{ color: "var(--text-2)" }}>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3.5 h-3 rounded-[4px]" style={{ background: "var(--warn-tint)" }} /> Actividad Nexus
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3.5 h-3 rounded-[4px]" style={{ background: "var(--accent-tint)" }} /> Evento (Google Calendar)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3.5 h-3 rounded-full" style={{ background: "var(--purple)" }} /> Vacaciones
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3.5 h-3 rounded-[4px]" style={{ background: "var(--accent-tint)" }} /> Día inhábil
            </span>
          </div>
          </div>
        </div>
      )}

      {view === "Equipo" && granularity === "Semana" && (
        <div className="card p-4">
          <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
            {weekCells.map((c) => {
              const acts = deadlinesByDate.get(c.date) ?? [];
              const gevs = gcalByDate.get(c.date) ?? [];
              const people = vacationsByDate.get(c.date) ?? [];
              const empty = acts.length === 0 && gevs.length === 0 && people.length === 0 && !holidayOf.get(c.date);
              return (
                <div key={c.date} className="rounded-sm p-2.5 flex flex-col gap-1.5 min-h-[110px]"
                  style={{
                    background: people.length ? "var(--purple-tint)" : holidayOf.get(c.date) ? "var(--accent-tint)" : "var(--surface-2)",
                    outline: c.date === today ? "2px solid var(--accent)" : undefined,
                    outlineOffset: "-2px",
                  }}>
                  <div className="flex items-center justify-between">
                    <p className="text-[10.5px] font-bold uppercase tracking-wide" style={{ color: "var(--text-3)" }}>{DOW[mondayIndex(c.date)]}</p>
                    <p className="text-[13px] font-bold tabular-nums" style={{ color: "var(--text-2)" }}>{c.day}</p>
                  </div>
                  {holidayOf.get(c.date) && <p className="text-[10px] font-semibold" style={{ color: "var(--accent)" }}>{holidayOf.get(c.date)}</p>}

                  {acts.map((p) => {
                    const lead = p.project_assignments.find((a) => a.is_lead) ?? p.project_assignments[0];
                    return (
                      <p key={p.id} className="text-[10.5px] font-semibold px-1.5 py-1 rounded-[4px]"
                        style={{ background: "var(--warn-tint)", color: "var(--warn)" }}
                        title={lead ? lead.users.display_name : undefined}>
                        {p.requests?.title ?? "Actividad"}
                      </p>
                    );
                  })}

                  {gevs.map((ev) => (
                    <p key={ev.id} className="text-[10.5px] font-semibold px-1.5 py-1 rounded-[4px]"
                      style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
                      title="Eventos CERT (Google Calendar)">
                      {ev.title}
                    </p>
                  ))}

                  {people.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
                      {people.map((u) => (
                        <div key={u.id} title="Vacaciones" className="flex items-center gap-1 pr-1.5 rounded-full" style={{ background: "var(--purple-tint)" }}>
                          <Avatar name={u.display_name} color={u.nexus_color} size={16} avatarUrl={u.avatar_url} birthday={isBirthdayToday(u.birth_date, todayISO())} />
                          <span className="text-[9.5px] font-semibold" style={{ color: "var(--purple)" }}>{u.display_name.split(" ")[0]}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {empty && <p className="text-[10px]" style={{ color: "var(--text-3)" }}>Sin eventos</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === "Equipo" && granularity === "Día" && (() => {
        const acts = deadlinesByDate.get(focusDate) ?? [];
        const gevs = gcalByDate.get(focusDate) ?? [];
        const people = vacationsByDate.get(focusDate) ?? [];
        const holiday = holidayOf.get(focusDate);
        const empty = acts.length === 0 && gevs.length === 0 && people.length === 0 && !holiday;
        return (
          <div className="card p-5 flex flex-col gap-3">
            {holiday && (
              <div className="flex items-center gap-3 px-3.5 py-3 rounded-sm" style={{ background: "var(--accent-tint)" }}>
                <Icon name="calendar" size={16} style={{ color: "var(--accent)" }} />
                <p className="text-[13.5px] font-bold" style={{ color: "var(--accent)" }}>{holiday} · Día inhábil</p>
              </div>
            )}
            {acts.map((p) => {
              const lead = p.project_assignments.find((a) => a.is_lead) ?? p.project_assignments[0];
              return (
                <div key={p.id} className="flex items-center gap-3 px-3.5 py-3 rounded-sm" style={{ background: "var(--warn-tint)" }}>
                  <Icon name="flag" size={16} style={{ color: "var(--warn)" }} />
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-bold truncate" style={{ color: "var(--warn)" }}>{p.requests?.title ?? "Actividad"}</p>
                    {lead && <p className="text-[12px]" style={{ color: "var(--text-2)" }}>{lead.users.display_name}</p>}
                  </div>
                </div>
              );
            })}
            {gevs.map((ev) => (
              <div key={ev.id} className="flex items-center gap-3 px-3.5 py-3 rounded-sm" style={{ background: "var(--accent-tint)" }}>
                <Icon name="calendar" size={16} style={{ color: "var(--accent)" }} />
                <p className="text-[13.5px] font-bold" style={{ color: "var(--accent)" }}>{ev.title}</p>
              </div>
            ))}
            {people.length > 0 && (
              <div className="px-3.5 py-3 rounded-sm" style={{ background: "var(--purple-tint)" }}>
                <p className="text-[12px] font-bold mb-2" style={{ color: "var(--purple)" }}>De vacaciones hoy</p>
                <div className="flex flex-wrap gap-3">
                  {people.map((u) => (
                    <div key={u.id} className="flex items-center gap-1.5">
                      <Avatar name={u.display_name} color={u.nexus_color} size={22} avatarUrl={u.avatar_url} birthday={isBirthdayToday(u.birth_date, todayISO())} />
                      <span className="text-[12.5px] font-semibold">{u.display_name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
