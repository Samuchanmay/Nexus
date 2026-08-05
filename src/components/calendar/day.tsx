"use client";
import { useEffect, useMemo, useState } from "react";
import { minutesOfDay, layoutDayOverlaps, HOUR_HEIGHT_PX, nowLineOffsetPx } from "@/lib/calendar-core";
import { nowMeridaMinutes } from "@/lib/tz";
import type { CalendarEvent } from "./types";
import { eventColor, eventLabel } from "./types";
import { useCalendarEngine } from "./engine";

/* ── Calendar Engine · vista Día (EMET-CALENDAR-ENGINE.md §5.2, §5.5, §8.2) ──
   Gutter de horas + eventos con hora como líneas de color con layout de
   solapamiento + línea de "ahora" (roja, solo si `date` es hoy). Los
   eventos allDay (vacaciones, institucionales, cumpleaños…) se muestran
   arriba, fuera de la rejilla horaria — nunca ocupan un huequito de hora. */

export function DayView({
  date,
  startHour = 7,
  endHour = 20,
  onSlotClick,
  onEventClick,
}: {
  date: string;
  startHour?: number;
  endHour?: number;
  onSlotClick?: (date: string, hour: number) => void;
  onEventClick?: (ev: CalendarEvent) => void;
}) {
  const { today, visibleEvents } = useCalendarEngine();
  const [nowMin, setNowMin] = useState<number | null>(null);

  // El reloj de "ahora" solo corre en cliente (evita mismatch de hidratación)
  // y se refresca cada minuto — mismo patrón que el resto de EMET (Jornada).
  useEffect(() => {
    setNowMin(nowMeridaMinutes());
    const id = setInterval(() => setNowMin(nowMeridaMinutes()), 60_000);
    return () => clearInterval(id);
  }, []);

  const dayEvents = useMemo(() => visibleEvents.filter((ev) => {
    const s = ev.start.slice(0, 10), e = ev.end.slice(0, 10);
    return date >= s && date <= e;
  }), [visibleEvents, date]);

  const allDayEvents = useMemo(() => dayEvents.filter((ev) => ev.allDay), [dayEvents]);
  const timedEvents = useMemo(() => dayEvents.filter((ev) => !ev.allDay), [dayEvents]);

  const layout = useMemo(() => {
    const rows = timedEvents.map((ev) => ({
      id: ev.id,
      startMin: Math.max(startHour * 60, minutesOfDay(ev.start)),
      endMin: Math.min(endHour * 60, Math.max(minutesOfDay(ev.end), minutesOfDay(ev.start) + 30)),
    }));
    return layoutDayOverlaps(rows);
  }, [timedEvents, startHour, endHour]);

  const hours = useMemo(() => {
    const out: number[] = [];
    for (let h = startHour; h < endHour; h++) out.push(h);
    return out;
  }, [startHour, endHour]);

  const isToday = date === today;
  const nowOffset = isToday && nowMin != null ? nowLineOffsetPx(nowMin, startHour, endHour) : null;

  return (
    <div className="card p-0 overflow-hidden">
      {allDayEvents.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}>
          {allDayEvents.map((ev) => (
            <button key={ev.id} type="button" onClick={() => onEventClick?.(ev)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all hover:scale-[1.02] hover:shadow-md"
              style={{ 
                background: `color-mix(in srgb, ${eventColor(ev.kind)} 18%, transparent)`, 
                color: eventColor(ev.kind),
                borderLeft: `3px solid ${eventColor(ev.kind)}`
              }}>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: eventColor(ev.kind) }} />
              {ev.title}
            </button>
          ))}
        </div>
      )}

      <div className="relative overflow-y-auto" style={{ maxHeight: 640 }}>
        <div className="relative flex">
          <div className="shrink-0 w-14 text-right pr-3" style={{ paddingTop: 0 }}>
            {hours.map((h) => (
              <div key={h} className="text-[12px] font-semibold tabular-nums"
                style={{ height: HOUR_HEIGHT_PX, color: "var(--text-3)", paddingTop: "4px" }}>
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>
          <div className="relative flex-1" style={{ borderLeft: "1px solid var(--border)" }}>
            {hours.map((h) => (
              <div
                key={h}
                onClick={() => onSlotClick?.(date, h)}
                className="cursor-pointer transition-colors hover:bg-hover"
                style={{ height: HOUR_HEIGHT_PX, borderBottom: "1px solid var(--border)" }}
              />
            ))}

            {nowOffset != null && (
              <div className="absolute left-0 right-0 pointer-events-none z-[70] flex items-center"
                style={{ top: nowOffset }}>
                <span className="w-3 h-3 rounded-full -ml-[6px] shadow-lg" style={{ background: "var(--ev-red)", boxShadow: "0 0 8px var(--ev-red)" }} />
                <span className="flex-1" style={{ height: 2, background: "var(--ev-red)", boxShadow: "0 0 4px var(--ev-red)" }} />
              </div>
            )}

            {timedEvents.map((ev) => {
              const l = layout.get(ev.id);
              if (!l) return null;
              const top = ((Math.max(startHour * 60, minutesOfDay(ev.start)) - startHour * 60) / 60) * HOUR_HEIGHT_PX;
              const rawEnd = Math.max(minutesOfDay(ev.end), minutesOfDay(ev.start) + 30);
              const bottom = ((Math.min(endHour * 60, rawEnd) - startHour * 60) / 60) * HOUR_HEIGHT_PX;
              const height = Math.max(28, bottom - top);
              return (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => onEventClick?.(ev)}
                  className="absolute rounded-lg text-left px-2.5 py-1.5 overflow-hidden transition-all hover:scale-[1.02] hover:shadow-lg"
                  style={{
                    top, height,
                    left: `calc(${l.left}% + 4px)`,
                    width: `calc(${l.width}% - 8px)`,
                    zIndex: l.zIndex,
                    background: `color-mix(in srgb, ${eventColor(ev.kind)} 15%, var(--surface))`,
                    borderLeft: `3px solid ${eventColor(ev.kind)}`,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.08)"
                  }}
                  title={`${ev.title} · ${eventLabel(ev.kind)}`}
                >
                  <span className="block text-[12px] font-semibold truncate" style={{ color: "var(--text-1)" }}>{ev.title}</span>
                  {height > 40 && (
                    <span className="block text-[11px] truncate mt-0.5" style={{ color: "var(--text-2)" }}>{eventLabel(ev.kind)}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {dayEvents.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-2xl grid place-items-center mb-4 mx-auto" style={{ background: "var(--ok-tint)" }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--ok)" }}>
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
          </div>
          <p className="text-[16px] font-semibold text-text-1 mb-1">Tu día está libre</p>
          <p className="text-[13px]" style={{ color: "var(--text-3)" }}>No hay eventos programados para hoy.</p>
        </div>
      )}
    </div>
  );
}
