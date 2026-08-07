"use client";
import { useMemo, useState } from "react";
import { DOW } from "@/lib/calendar-core";
import { buildMonthGrid, monthBounds } from "@/lib/calendar-grid";
import { addDays } from "@/lib/tz";
import type { CalendarEvent } from "./types";
import { eventColor } from "./types";
import { useCalendarEngine } from "./engine";
import { DayPopover } from "./event-popover";

/* ── Calendar Engine · vista Mes ──
   (EMET-CALENDAR-ENGINE.md §8.4) — rejilla Lun–Dom con:
   · número del día (hoy = círculo accent, la ÚNICA píldora)
   · puntos indicadores de color por tipo (máx 3) + "+n" discreto
   · NUNCA tarjetas/chips dentro de la celda
   · click en "+n" o en el día con eventos → DayPopover con la lista
   Usa el contexto del motor (visibleEvents, layers, cursor, selectedDate). */

const MAX_DOTS = 3;

export function MonthView({
  ym,
  onDayClick,
  onEventClick,
  cellTint,
  // Backlog #135 (7 ago 2026): antes forzaba min-w-[640px] SIEMPRE, así que
  // en celular la rejilla de 7 columnas nunca cabía y quedaba con scroll
  // horizontal. Un mes con solo número+puntos sí cabe en una pantalla
  // angosta si se le permite encogerse — el min-width grande ahora solo
  // aplica desde `sm:` (≥640px), donde ya hay espacio real que aprovechar.
  minWidth = "sm:min-w-[640px]",
}: {
  ym: string;
  onDayClick?: (date: string) => void;
  onEventClick?: (ev: CalendarEvent) => void;
  /** Pinta el fondo de la celda por fecha (ej. purple-tint si alguien está de vacaciones). */
  cellTint?: (date: string) => string | undefined;
  minWidth?: string;
}) {
  const { today, setCursor, visibleEvents, selectedDate, setSelectedDate } = useCalendarEngine();
  const [popoverDate, setPopoverDate] = useState<string | null>(null);

  const { daysInMonth } = useMemo(() => monthBounds(ym), [ym]);
  const first = `${ym}-01`;
  const last = `${ym}-${String(daysInMonth).padStart(2, "0")}`;
  const cells = useMemo(() => buildMonthGrid(first, last, daysInMonth), [first, last, daysInMonth]);

  const eventsByDate = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const ev of visibleEvents) {
      const s = ev.start.slice(0, 10);
      const e = ev.end.slice(0, 10);
      if (e < first || s > last) continue;
      let d = s < first ? first : s;
      let guard = 0;
      while (d <= e && d <= last && guard < 62) {
        const list = m.get(d) ?? [];
        list.push(ev);
        m.set(d, list);
        d = addDays(d, 1);
        guard++;
      }
    }
    return m;
  }, [visibleEvents, first, last]);

  const select = (date: string) => {
    setCursor(date);
    setSelectedDate(date);
    onDayClick?.(date);
  };

  return (
    <div className="card p-3 sm:p-5 overflow-x-auto">
      <div className={minWidth}>
        {/* Días de la semana */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 sm:mb-3">
          {DOW.map((d) => (
            <p key={d} className="text-center text-[10.5px] sm:text-[12px] font-bold uppercase tracking-wide" style={{ color: "var(--text-3)" }}>{d}</p>
          ))}
        </div>

        {/* Celdas del calendario */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {cells.map((c) => {
            const evs = eventsByDate.get(c.date) ?? [];
            const tint = cellTint?.(c.date);
            const isToday = c.date === today;
            const isSelected = c.date === selectedDate;
            const dotColors = Array.from(new Set(evs.map((ev) => eventColor(ev.kind)))).slice(0, MAX_DOTS);
            const more = evs.length - dotColors.length;
            return (
              <div
                key={c.date}
                onClick={() => {
                  if (evs.length > 0) { setPopoverDate(c.date); setSelectedDate(c.date); }
                  else select(c.date);
                }}
                onMouseEnter={() => setCursor(c.date)}
                className="rounded-xl p-1.5 sm:p-2.5 min-h-[56px] sm:min-h-[88px] flex flex-col gap-1 sm:gap-1.5 cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-md"
                style={{
                  background: tint ?? (isSelected ? "var(--accent-tint)" : "var(--surface-2)"),
                  opacity: c.inMonth ? 1 : 0.35,
                  border: isToday ? "2px solid var(--accent)" : "2px solid transparent",
                  boxShadow: isToday ? "0 0 0 4px var(--accent-tint)" : undefined,
                }}
                title={evs.length ? `${evs.length} evento${evs.length === 1 ? "" : "s"} · ${evs.slice(0, 4).map((ev) => ev.title).join(" · ")}` : undefined}
                aria-current={isToday ? "date" : undefined}
              >
                {/* Número del día */}
                <div className="flex items-center justify-between">
                  <span
                    className="text-[11.5px] sm:text-[13.5px] font-bold tabular-nums w-5 h-5 sm:w-6 sm:h-6 grid place-items-center rounded-full"
                    style={{
                      color: isToday ? "#fff" : c.inMonth ? "var(--text-1)" : "var(--text-3)",
                      background: isToday ? "var(--accent)" : "transparent",
                    }}>
                    {c.day}
                  </span>
                  {/* Chip "+n" en vez de texto flotante */}
                  {more > 0 && (
                    <span 
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: "var(--surface-3)", color: "var(--text-2)" }}>
                      +{more}
                    </span>
                  )}
                </div>
                
                {/* Puntos indicadores */}
                {dotColors.length > 0 && (
                  <div className="flex items-center gap-1 mt-auto">
                    {dotColors.map((col, i) => (
                      <span key={i} className="w-2 h-2 rounded-full shrink-0" style={{ background: col }} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {popoverDate && (
        <DayPopover
          date={popoverDate}
          events={eventsByDate.get(popoverDate) ?? []}
          onClose={() => setPopoverDate(null)}
          onEventClick={onEventClick}
        />
      )}
    </div>
  );
}
