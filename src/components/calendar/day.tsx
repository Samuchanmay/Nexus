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
        <div className="flex flex-wrap gap-1.5 px-4 py-3" style={{ borderBottom: "0.5px solid var(--border)" }}>
          {allDayEvents.map((ev) => (
            <button key={ev.id} type="button" onClick={() => onEventClick?.(ev)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold transition-colors hover:bg-hover"
              style={{ background: `color-mix(in srgb, ${eventColor(ev.kind)} 14%, transparent)`, color: eventColor(ev.kind) }}>
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: eventColor(ev.kind) }} />
              {ev.title}
            </button>
          ))}
        </div>
      )}

      <div className="relative overflow-y-auto" style={{ maxHeight: 640 }}>
        <div className="relative flex">
          <div className="shrink-0 w-14 text-right pr-2.5" style={{ paddingTop: 0 }}>
            {hours.map((h) => (
              <div key={h} className="text-[11px] font-semibold tabular-nums"
                style={{ height: HOUR_HEIGHT_PX, color: "var(--text-3)" }}>
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>
          <div className="relative flex-1" style={{ borderLeft: "0.5px solid var(--border)" }}>
            {hours.map((h) => (
              <div
                key={h}
                onClick={() => onSlotClick?.(date, h)}
                className="cursor-pointer transition-colors hover:bg-hover"
                style={{ height: HOUR_HEIGHT_PX, borderBottom: "0.5px solid var(--border)" }}
              />
            ))}

            {nowOffset != null && (
              <div className="absolute left-0 right-0 pointer-events-none z-[70] flex items-center"
                style={{ top: nowOffset }}>
                <span className="w-1.5 h-1.5 rounded-full -ml-[3px]" style={{ background: "var(--ev-red)" }} />
                <span className="flex-1" style={{ height: 1.5, background: "var(--ev-red)" }} />
              </div>
            )}

            {timedEvents.map((ev) => {
              const l = layout.get(ev.id);
              if (!l) return null;
              const top = ((Math.max(startHour * 60, minutesOfDay(ev.start)) - startHour * 60) / 60) * HOUR_HEIGHT_PX;
              const rawEnd = Math.max(minutesOfDay(ev.end), minutesOfDay(ev.start) + 30);
              const bottom = ((Math.min(endHour * 60, rawEnd) - startHour * 60) / 60) * HOUR_HEIGHT_PX;
              const height = Math.max(20, bottom - top);
              return (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => onEventClick?.(ev)}
                  className="absolute rounded-[6px] text-left px-2 py-1 overflow-hidden transition-transform hover:-translate-y-px"
                  style={{
                    top, height,
                    left: `calc(${l.left}% + 3px)`,
                    width: `calc(${l.width}% - 6px)`,
                    zIndex: l.zIndex,
                    background: `color-mix(in srgb, ${eventColor(ev.kind)} 10%, var(--surface))`,
                    borderLeft: `3px solid ${eventColor(ev.kind)}`,
                  }}
                  title={`${ev.title} · ${eventLabel(ev.kind)}`}
                >
                  <span className="block text-[11.5px] font-semibold truncate">{ev.title}</span>
                  {height > 34 && (
                    <span className="block text-[10.5px] truncate" style={{ color: "var(--text-2)" }}>{eventLabel(ev.kind)}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {dayEvents.length === 0 && (
        <p className="text-[13px] py-8 text-center" style={{ color: "var(--text-3)" }}>Tu día está libre.</p>
      )}
    </div>
  );
}
