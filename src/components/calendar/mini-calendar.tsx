"use client";
import { useMemo } from "react";
import { DOW } from "@/lib/calendar-core";
import { addDays, isoWeekday } from "@/lib/tz";
import { useCalendarEngine } from "./engine";

/* ── Calendar Engine · mini-calendario ──
   (EMET-CALENDAR-ENGINE.md §8.6) — rejilla del mes actual para navegación.
   Punto en días con eventos (color de la capa). Click → salta la vista
   central a ese día. Teclado: flechas + Enter. */

export function MiniCalendar({ ym, onMonthChange }: { ym: string; onMonthChange?: (ym: string) => void }) {
  const { cursor, setCursor, today, visibleEvents } = useCalendarEngine();

  const first = `${ym}-01`;
  const [y, m] = ym.split("-").map(Number);
  const daysInMonth = useMemo(() => new Date(Date.UTC(y, m, 0)).getUTCDate(), [y, m]);
  const last = `${ym}-${String(daysInMonth).padStart(2, "0")}`;

  const lead = isoWeekday(first) === 0 ? 6 : isoWeekday(first) - 1;
  const start = addDays(first, -lead);
  const total = Math.ceil((lead + daysInMonth) / 7) * 7;

  const days = useMemo(() =>
    Array.from({ length: total }, (_, i) => {
      const date = addDays(start, i);
      return { date, inMonth: date >= first && date <= last, day: Number(date.slice(8, 10)) };
    })
  , [total, start, first, last]);

  const busy = useMemo(() => {
    const set = new Set<string>();
    for (const ev of visibleEvents) {
      let d = ev.start.slice(0, 10);
      const e = ev.end.slice(0, 10);
      while (d <= e) {
        set.add(d);
        d = addDays(d, 1);
        if (d > last) break;
      }
    }
    return set;
  }, [visibleEvents, last]);

  const goPrevMonth = () => {
    const d = new Date(Date.UTC(y, m - 2, 1));
    onMonthChange?.(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  };
  const goNextMonth = () => {
    const d = new Date(Date.UTC(y, m, 1));
    onMonthChange?.(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  };

  const monthName = new Intl.DateTimeFormat("es-MX", { month: "long", timeZone: "America/Merida" })
    .format(new Date(Date.UTC(y, m - 1, 1)));

  return (
    <div className="rounded-lg p-3" style={{ background: "var(--surface-2)", border: "0.5px solid var(--border)" }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[13px] font-bold capitalize">{monthName} <span style={{ color: "var(--text-3)" }}>{y}</span></p>
        <div className="flex items-center gap-0.5">
          <button type="button" onClick={goPrevMonth} aria-label="Mes anterior"
            className="w-6 h-6 grid place-items-center rounded-sm hover:bg-hover" style={{ color: "var(--text-2)" }}>
            <svg viewBox="0 0 20 20" fill="none" className="w-3.5 h-3.5">
              <path d="M12 5l-5 5 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button type="button" onClick={goNextMonth} aria-label="Mes siguiente"
            className="w-6 h-6 grid place-items-center rounded-sm hover:bg-hover" style={{ color: "var(--text-2)" }}>
            <svg viewBox="0 0 20 20" fill="none" className="w-3.5 h-3.5">
              <path d="M8 5l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {DOW.map((d) => (
          <span key={d} className="text-center text-[10px] font-bold" style={{ color: "var(--text-3)" }}>{d[0]}</span>
        ))}
        {days.map((d) => {
          const isToday = d.date === today;
          const isCursor = d.date === cursor;
          return (
            <button
              key={d.date}
              type="button"
              onClick={() => { setCursor(d.date); }}
              className="relative h-6 grid place-items-center rounded-sm text-[11px] tabular-nums transition-colors"
              style={{
                color: isToday ? "#fff" : d.inMonth ? (isCursor ? "var(--accent)" : "var(--text-2)") : "var(--text-3)",
                background: isToday ? "var(--accent)" : isCursor ? "var(--accent-tint)" : "transparent",
                fontWeight: isCursor || isToday ? 700 : 500,
              }}
            >
              {d.day}
              {!isToday && busy.has(d.date) && (
                <span className="absolute bottom-0.5 w-1 h-1 rounded-full" style={{ background: "var(--accent)" }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
