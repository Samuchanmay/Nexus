"use client";
import { useMemo } from "react";
import { MONTHS } from "@/lib/calendar-core";
import { addDays, isoWeekday } from "@/lib/tz";
import type { CalendarEvent, CalendarEventKind } from "./types";
import { eventColor } from "./types";
import { useCalendarEngine } from "./engine";

/* ── Calendar Engine · vista Año (EMET-CALENDAR-ENGINE.md §8.5) ──
   Heatmap de 12 meses (estilo GitHub): la intensidad de cada día refleja
   su carga de eventos, coloreada por el tipo dominante de ese día. NO son
   12 mini-calendarios de navegación (eso es el mini-calendario del
   sidebar) — aquí el objetivo es ver temporadas de un vistazo. */

// Prioridad de color cuando un día tiene varios tipos de evento — el tipo
// "más importante de recordar" gana el color del día (vacaciones antes que
// trabajo, ausencias antes que trabajo, trabajo antes que días inhábiles).
const KIND_PRIORITY: CalendarEventKind[] = [
  "vacacion", "permiso", "incapacidad", "home_office", "comision",
  "actividad", "proyecto", "evento_institucional", "google",
  "cumpleanos", "recordatorio", "disponibilidad", "inhabil",
];

function dominantKind(kinds: CalendarEventKind[]): CalendarEventKind {
  const counts = new Map<CalendarEventKind, number>();
  for (const k of kinds) counts.set(k, (counts.get(k) ?? 0) + 1);
  let best: CalendarEventKind = kinds[0];
  let bestScore = -1;
  for (const k of counts.keys()) {
    const score = (counts.get(k) ?? 0) * 100 - KIND_PRIORITY.indexOf(k);
    if (score > bestScore) { bestScore = score; best = k; }
  }
  return best;
}

function MiniMonthHeatmap({
  year, month, dayData, today, onMonthClick, onDayClick,
}: {
  year: number;
  month: number; // 1-12
  dayData: Map<string, CalendarEvent[]>;
  today: string;
  onMonthClick?: (ym: string) => void;
  onDayClick?: (date: string) => void;
}) {
  const ym = `${year}-${String(month).padStart(2, "0")}`;
  const first = `${ym}-01`;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lead = isoWeekday(first) === 0 ? 6 : isoWeekday(first) - 1;
  const start = addDays(first, -lead);
  const totalCells = Math.ceil((lead + daysInMonth) / 7) * 7;
  const isCurrentMonth = ym === today.slice(0, 7);

  const cells = Array.from({ length: totalCells }, (_, i) => {
    const date = addDays(start, i);
    const inMonth = date.slice(0, 7) === ym;
    return { date, inMonth, day: Number(date.slice(8, 10)) };
  });

  return (
    <div>
      <button type="button" onClick={() => onMonthClick?.(ym)}
        className="text-[13px] font-bold capitalize mb-2 px-2 py-1 rounded-lg transition-all hover:bg-hover"
        style={isCurrentMonth ? { color: "var(--accent)" } : undefined}>
        {MONTHS[month - 1]}
      </button>
      <div className="grid grid-cols-7 gap-[4px]">
        {cells.map((c) => {
          const events = c.inMonth ? (dayData.get(c.date) ?? []) : [];
          const count = events.length;
          const kind = count > 0 ? dominantKind(events.map((e) => e.kind)) : null;
          const color = kind ? eventColor(kind) : "var(--surface-2)";
          const alpha = count === 0 ? 0 : Math.min(0.9, 0.22 + count * 0.16);
          const isToday = c.date === today;
          return (
            <button
              key={c.date}
              type="button"
              disabled={!c.inMonth}
              onClick={() => onDayClick?.(c.date)}
              title={c.inMonth ? `${c.day} ${MONTHS[month - 1]} · ${count} evento${count === 1 ? "" : "s"}` : undefined}
              className="aspect-square rounded-md transition-all hover:scale-110 hover:shadow-md"
              style={{
                background: count > 0 ? `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, var(--surface-2))` : "var(--surface-2)",
                opacity: c.inMonth ? 1 : 0.25,
                outline: isToday ? "2px solid var(--accent)" : "none",
                outlineOffset: 1,
                boxShadow: isToday ? "0 0 0 3px var(--accent-tint)" : "none"
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

export function YearView({
  year,
  onMonthClick,
  onDayClick,
}: {
  year: number;
  onMonthClick?: (ym: string) => void;
  onDayClick?: (date: string) => void;
}) {
  const { today, visibleEvents } = useCalendarEngine();

  const dayData = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    const yStart = `${year}-01-01`, yEnd = `${year}-12-31`;
    for (const ev of visibleEvents) {
      const s = ev.start.slice(0, 10), e = ev.end.slice(0, 10);
      if (e < yStart || s > yEnd) continue;
      let d = s < yStart ? yStart : s;
      let guard = 0;
      while (d <= e && d <= yEnd && guard < 370) {
        const list = m.get(d) ?? [];
        list.push(ev);
        m.set(d, list);
        d = addDays(d, 1);
        guard++;
      }
    }
    return m;
  }, [visibleEvents, year]);

  return (
    <div className="card p-4">
      <div className="grid gap-x-5 gap-y-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
        {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
          <MiniMonthHeatmap key={month} year={year} month={month} dayData={dayData} today={today}
            onMonthClick={onMonthClick} onDayClick={onDayClick} />
        ))}
      </div>
    </div>
  );
}
