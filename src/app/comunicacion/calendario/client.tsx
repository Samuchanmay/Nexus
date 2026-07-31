"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SlidingSegments } from "@/components/ui";
import { Icon } from "@/components/os/icons";
import { MONTHS, dayLongLabel, weekRangeLabel, weekStartOf, daysInRange } from "@/lib/calendar-core";
import { shiftMonth } from "@/lib/calendar-grid";
import { dmy, addDays } from "@/lib/tz";
import { holidayStyle } from "@/lib/ui-maps";
import { usePersistedView } from "@/lib/persisted-view";
import { CalendarEngine, CalendarHeader, MonthView, WeekView, DayView, AgendaView, YearView, CalendarLegend, CalendarRightPanel, CalendarFilterBar } from "@/components/calendar";
import type { CalendarEvent, CalendarLayer } from "@/components/calendar";

const GRANULARITIES = ["Agenda", "Día", "Semana", "Mes", "Año"] as const;
type Granularity = (typeof GRANULARITIES)[number];

export type VacationRange = { start_date: string; end_date: string };
export type Deadline = { id: string; deadline: string | null; status: string; requests: { title: string; type: string } | null };
export type GcalEvent = { id: string; title: string; start: string; end: string; allDay: boolean };
export type NextActivity = { deadline: string; status: string; requests: { title: string } | null } | null;
export type InstitutionalEvent = { id: string; title: string; kind: string; start_date: string; end_date: string; notes: string | null };

/* ═══════════════════════════════════════════════════════════════
   Calendario personal — mismas cinco vistas del motor (Agenda/Día/
   Semana/Mes/Año, Fase B de EMET-CALENDAR-ENGINE.md) que admin/
   calendario (Plano Maestro — pedido explícito de que la
   granularidad aplique parejo en toda la app, no solo para el
   admin), sobre las fechas límite, vacaciones, días inhábiles y
   eventos de Google Calendar de UNA sola persona.
   ═══════════════════════════════════════════════════════════════ */
export default function CalendarioClient({
  ym, year, month, daysInMonth, today, prevHref, nextHref,
  vacations, holidays, deadlines, gcalEvents, gcalError, nextActivity, initialFocusDate,
  institutionalEvents,
}: {
  ym: string; year: number; month: number; daysInMonth: number; today: string;
  prevHref: string; nextHref: string;
  vacations: VacationRange[]; holidays: { date: string; name: string; kind: string }[];
  deadlines: Deadline[]; gcalEvents?: GcalEvent[]; gcalError?: string | null;
  nextActivity?: NextActivity; initialFocusDate?: string;
  institutionalEvents?: InstitutionalEvent[];
}) {
  const router = useRouter();
  const [granularity, setGranularity] = usePersistedView<Granularity>(
    "calendario.empleado.granularity", GRANULARITIES, "Mes"
  );
  const [focusDate, setFocusDate] = useState(initialFocusDate ?? today);

  const first = `${ym}-01`;
  const last = `${ym}-${String(daysInMonth).padStart(2, "0")}`;
  // `holidays` llega con el AÑO completo (para la vista Año del motor) —
  // acotado de vuelta al mes en pantalla para el resumen de abajo.
  const monthHolidays = useMemo(() => holidays.filter((h) => h.date >= first && h.date <= last), [holidays, first, last]);
  const onVacation = (date: string) => vacations.some((v) => v.start_date <= date && v.end_date >= date);

  // Semana enfocada (Lun–Dom) que contiene focusDate.
  const weekStart = useMemo(() => weekStartOf(focusDate), [focusDate]);
  const weekCells = useMemo(() => daysInRange(weekStart, addDays(weekStart, 6)).map((date) => ({ date })), [weekStart]);

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
  const shiftYear = (dir: 1 | -1) => router.push(`/comunicacion/calendario?m=${shiftMonth(ym, dir * 12)}`);
  const goToDate = (date: string) => {
    setGranularity("Día");
    const newYm = date.slice(0, 7);
    if (newYm !== ym) router.push(`/comunicacion/calendario?m=${newYm}&d=${date}`);
    else setFocusDate(date);
  };
  const goToMonth = (newYm: string) => {
    setGranularity("Mes");
    if (newYm !== ym) router.push(`/comunicacion/calendario?m=${newYm}`);
  };

  // ── Calendar Engine: todas las fuentes normalizadas a CalendarEvent[]. ──
  const events = useMemo<CalendarEvent[]>(() => {
    const out: CalendarEvent[] = [];
    for (const p of deadlines) {
      if (!p.deadline || p.status === "cancelada" || p.status === "rechazada") continue;
      out.push({
        id: `act-${p.id}`, kind: "actividad",
        title: p.requests?.title ?? "Actividad",
        start: p.deadline, end: p.deadline, allDay: true,
        source: "db",
      });
    }
    for (const v of vacations) {
      out.push({
        id: `vac-${v.start_date}`, kind: "vacacion",
        title: "Vacaciones",
        start: v.start_date, end: v.end_date, allDay: true,
        source: "db",
      });
    }
    for (const ev of institutionalEvents ?? []) {
      out.push({
        id: `inst-${ev.id}`, kind: "evento_institucional",
        title: ev.title, start: ev.start_date, end: ev.end_date, allDay: true,
        source: "db",
      });
    }
    for (const ev of gcalEvents ?? []) {
      out.push({
        id: `g-${ev.id}`, kind: "google",
        title: ev.title,
        start: ev.start,
        end: ev.allDay && ev.end.length === 10 ? addDays(ev.end, -1) : ev.end, // Google: "end" exclusivo en todo el día
        allDay: ev.allDay,
        source: "google",
      });
    }
    for (const h of holidays) {
      out.push({ id: `hol-${h.date}`, kind: "inhabil", title: h.name, start: h.date, end: h.date, allDay: true, source: "db" });
    }
    return out;
  }, [deadlines, vacations, institutionalEvents, gcalEvents, holidays]);

  const layers = useMemo<CalendarLayer[]>(() => [
    { key: "actividad", label: "Actividades", color: "var(--ev-blue)", active: true },
    { key: "vacacion", label: "Vacaciones", color: "var(--ev-purple)", active: true },
    { key: "evento_institucional", label: "Institucional", color: "var(--ev-blue)", active: true },
    { key: "google", label: "Google Calendar", color: "var(--ev-blue)", active: true },
    { key: "inhabil", label: "Días inhábiles", color: "var(--ev-gray)", active: true },
  ], []);

  const legendItems = [
    { color: "var(--ev-blue)", label: "Actividades · Institucional · Google" },
    { color: "var(--ev-purple)", label: "Vacaciones" },
    { color: "var(--ev-gray)", label: "Días inhábiles" },
  ];

  const cellTint = (date: string) => (onVacation(date) ? "var(--purple-tint)" : undefined);

  const title = granularity === "Mes" ? `${MONTHS[month - 1]} ${year}`
    : granularity === "Semana" ? weekRangeLabel(weekCells)
    : granularity === "Día" ? dayLongLabel(focusDate)
    : granularity === "Año" ? `${year}`
    : "Agenda";

  return (
    <>
      <CalendarHeader
        title={title}
        subtitle="Tus fechas límite, vacaciones y días inhábiles"
        prevHref={granularity === "Mes" ? prevHref : undefined}
        nextHref={granularity === "Mes" ? nextHref : undefined}
        onPrev={granularity === "Mes" || granularity === "Agenda" ? undefined : granularity === "Año" ? () => shiftYear(-1) : () => shiftFocus(-1)}
        onNext={granularity === "Mes" || granularity === "Agenda" ? undefined : granularity === "Año" ? () => shiftYear(1) : () => shiftFocus(1)}
        todayHref={granularity === "Mes" ? "/comunicacion/calendario" : undefined}
        onToday={granularity === "Mes" || granularity === "Agenda" ? undefined : goToday}
      >
        <SlidingSegments options={[...GRANULARITIES]} value={granularity}
          onChange={(v) => setGranularity(v as Granularity)} />
      </CalendarHeader>

      {nextActivity && (nextActivity.deadline < first || nextActivity.deadline > last) && (
        <Link href={`/comunicacion/calendario?m=${nextActivity.deadline.slice(0, 7)}&d=${nextActivity.deadline}`}
          className="card p-4 mb-4 flex items-center justify-between gap-3 hover:bg-hover transition-colors">
          <div className="min-w-0">
            <p className="text-[12px] font-bold" style={{ color: "var(--text-3)" }}>Tu próxima actividad</p>
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

      <CalendarEngine today={today} events={events} layers={layers}>
        <CalendarFilterBar />
        <div className="flex flex-col lg:flex-row gap-5 items-start">
          <div className="flex-1 min-w-0 w-full">
            {granularity === "Mes" && (
              <>
                <MonthView ym={ym} cellTint={cellTint} />
                <div className="mt-3.5">
                  <CalendarLegend items={legendItems} />
                </div>
              </>
            )}
            {granularity === "Semana" && (
              <WeekView weekStart={weekStart} onDayClick={goToDate} />
            )}
            {granularity === "Día" && (
              <DayView date={focusDate} />
            )}
            {granularity === "Agenda" && (
              <AgendaView onDayClick={goToDate} />
            )}
            {granularity === "Año" && (
              <YearView year={year} onMonthClick={goToMonth} onDayClick={goToDate} />
            )}
          </div>
          <CalendarRightPanel />
        </div>
      </CalendarEngine>

      {monthHolidays.length > 0 && (
        <div className="card p-5 mt-4">
          <h2 className="text-[15px] font-bold mb-2.5">Días inhábiles de {MONTHS[month - 1]}</h2>
          <div className="flex flex-col gap-1.5">
            {monthHolidays.map((h) => {
              const st = holidayStyle(h.kind);
              return (
                <div key={h.date} className="flex items-center justify-between text-[13px]">
                  <span className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: st.fg }} />
                    <span className="font-semibold">{h.name}</span>
                  </span>
                  <span className="tabular-nums" style={{ color: "var(--text-3)" }}>{dmy(h.date)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
