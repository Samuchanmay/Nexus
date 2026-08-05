"use client";
import { useEffect, useMemo, useState } from "react";
import { DOW, minutesOfDay, layoutDayOverlaps, HOUR_HEIGHT_PX, nowLineOffsetPx } from "@/lib/calendar-core";
import { nowMeridaMinutes } from "@/lib/tz";
import type { CalendarEvent } from "./types";
import { eventColor } from "./types";
import { useCalendarEngine } from "./engine";

/* ── Calendar Engine · vista Semana (EMET-CALENDAR-ENGINE.md §8.3) ──
   7 columnas Lun–Dom, header sticky, fila allDay arriba, línea de "ahora"
   solo en la columna de hoy. Mismo layout de solapamiento que Día, una
   columna a la vez (los eventos de una semana no se comparan entre días
   distintos, solo dentro del mismo día). */

export function WeekView({
  weekStart,
  startHour = 7,
  endHour = 20,
  onDayClick,
  onEventClick,
}: {
  /** Lunes ISO de la semana a mostrar. */
  weekStart: string;
  startHour?: number;
  endHour?: number;
  onDayClick?: (date: string) => void;
  onEventClick?: (ev: CalendarEvent) => void;
}) {
  const { today, visibleEvents } = useCalendarEngine();
  const [nowMin, setNowMin] = useState<number | null>(null);

  useEffect(() => {
    setNowMin(nowMeridaMinutes());
    const id = setInterval(() => setNowMin(nowMeridaMinutes()), 60_000);
    return () => clearInterval(id);
  }, []);

  const weekDays = useMemo(() => {
    const [y, m, d] = weekStart.split("-").map(Number);
    const base = new Date(Date.UTC(y, m - 1, d));
    return Array.from({ length: 7 }, (_, i) => {
      const dt = new Date(base);
      dt.setUTCDate(base.getUTCDate() + i);
      return dt.toISOString().slice(0, 10);
    });
  }, [weekStart]);

  const eventsByDay = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const day of weekDays) {
      m.set(day, visibleEvents.filter((ev) => {
        const s = ev.start.slice(0, 10), e = ev.end.slice(0, 10);
        return day >= s && day <= e;
      }));
    }
    return m;
  }, [visibleEvents, weekDays]);

  const hours = useMemo(() => {
    const out: number[] = [];
    for (let h = startHour; h < endHour; h++) out.push(h);
    return out;
  }, [startHour, endHour]);

  const nowOffset = nowMin != null ? nowLineOffsetPx(nowMin, startHour, endHour) : null;

  return (
    <div className="card p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[820px]">
          {/* Header sticky + fila allDay */}
          <div className="grid sticky top-0 z-[50]" style={{ gridTemplateColumns: "56px repeat(7, 1fr)", background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
            <div />
            {weekDays.map((day, i) => {
              const isToday = day === today;
              return (
                <button key={day} type="button" onClick={() => onDayClick?.(day)}
                  className="flex flex-col items-center py-3 transition-all hover:bg-hover"
                  aria-current={isToday ? "date" : undefined}>
                  <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: isToday ? "var(--accent)" : "var(--text-3)" }}>{DOW[i]}</span>
                  <span className="text-[15px] font-bold tabular-nums w-8 h-8 mt-1 grid place-items-center rounded-full transition-all"
                    style={{ 
                      color: isToday ? "#fff" : "var(--text-1)", 
                      background: isToday ? "var(--accent)" : "transparent",
                      boxShadow: isToday ? "0 0 0 3px var(--accent-tint)" : "none"
                    }}>
                    {Number(day.slice(8, 10))}
                  </span>
                </button>
              );
            })}
          </div>
          {weekDays.some((d) => (eventsByDay.get(d) ?? []).some((ev) => ev.allDay)) && (
            <div className="grid" style={{ gridTemplateColumns: "56px repeat(7, 1fr)", borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}>
              <div />
              {weekDays.map((day) => (
                <div key={day} className="flex flex-col gap-1.5 p-2">
                  {(eventsByDay.get(day) ?? []).filter((ev) => ev.allDay).slice(0, 3).map((ev) => (
                    <button key={ev.id} type="button" onClick={() => onEventClick?.(ev)}
                      className="text-[11px] font-semibold truncate px-2 py-1 rounded-lg text-left transition-all hover:scale-[1.02] hover:shadow-md"
                      style={{ 
                        background: `color-mix(in srgb, ${eventColor(ev.kind)} 18%, transparent)`, 
                        color: eventColor(ev.kind),
                        borderLeft: `3px solid ${eventColor(ev.kind)}`
                      }}>
                      {ev.title}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Rejilla horaria */}
          <div className="relative grid" style={{ gridTemplateColumns: "56px repeat(7, 1fr)" }}>
            <div>
              {hours.map((h) => (
                <div key={h} className="text-right pr-3 text-[12px] font-semibold tabular-nums"
                  style={{ height: HOUR_HEIGHT_PX, color: "var(--text-3)", paddingTop: "4px" }}>
                  {String(h).padStart(2, "0")}:00
                </div>
              ))}
            </div>
            {weekDays.map((day) => {
              const timed = (eventsByDay.get(day) ?? []).filter((ev) => !ev.allDay);
              const layout = layoutDayOverlaps(timed.map((ev) => ({
                id: ev.id,
                startMin: Math.max(startHour * 60, minutesOfDay(ev.start)),
                endMin: Math.min(endHour * 60, Math.max(minutesOfDay(ev.end), minutesOfDay(ev.start) + 30)),
              })));
              const isToday = day === today;
              return (
                <div key={day} className="relative" style={{ borderLeft: "1px solid var(--border)" }}>
                  {hours.map((h) => (
                    <div key={h} style={{ height: HOUR_HEIGHT_PX, borderBottom: "1px solid var(--border)" }} />
                  ))}
                  {isToday && nowOffset != null && (
                    <div className="absolute left-0 right-0 pointer-events-none z-[70] flex items-center" style={{ top: nowOffset }}>
                      <span className="w-3 h-3 rounded-full -ml-[6px] shadow-lg" style={{ background: "var(--ev-red)", boxShadow: "0 0 8px var(--ev-red)" }} />
                      <span className="flex-1" style={{ height: 2, background: "var(--ev-red)", boxShadow: "0 0 4px var(--ev-red)" }} />
                    </div>
                  )}
                  {timed.map((ev) => {
                    const l = layout.get(ev.id);
                    if (!l) return null;
                    const top = ((Math.max(startHour * 60, minutesOfDay(ev.start)) - startHour * 60) / 60) * HOUR_HEIGHT_PX;
                    const rawEnd = Math.max(minutesOfDay(ev.end), minutesOfDay(ev.start) + 30);
                    const bottom = ((Math.min(endHour * 60, rawEnd) - startHour * 60) / 60) * HOUR_HEIGHT_PX;
                    const height = Math.max(24, bottom - top);
                    return (
                      <button key={ev.id} type="button" onClick={() => onEventClick?.(ev)}
                        className="absolute rounded-lg text-left px-2 py-1 overflow-hidden transition-all hover:scale-[1.02] hover:shadow-lg"
                        style={{
                          top, height,
                          left: `calc(${l.left}% + 3px)`, width: `calc(${l.width}% - 6px)`,
                          zIndex: l.zIndex,
                          background: `color-mix(in srgb, ${eventColor(ev.kind)} 15%, var(--surface))`,
                          borderLeft: `3px solid ${eventColor(ev.kind)}`,
                          boxShadow: "0 1px 3px rgba(0,0,0,0.08)"
                        }}
                        title={ev.title}>
                        <span className="block text-[11px] font-semibold truncate" style={{ color: "var(--text-1)" }}>{ev.title}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
