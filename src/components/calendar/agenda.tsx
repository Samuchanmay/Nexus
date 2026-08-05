"use client";
import { useMemo } from "react";
import { addDays } from "@/lib/tz";
import { dayLongLabel } from "@/lib/calendar-core";
import type { CalendarEvent } from "./types";
import { eventColor, eventLabel } from "./types";
import { useCalendarEngine } from "./engine";

/* ── Calendar Engine · vista Agenda (EMET-CALENDAR-ENGINE.md §8.1) ──
   Lista editorial agrupada Hoy/Mañana/Esta semana/Después. Eventos allDay y
   cumpleaños arriba de cada día, sin hora. Vista por defecto en móvil
   (aquí queda lista para usarse como tal desde las páginas que la wireen). */

const GROUP_LABELS = ["Hoy", "Mañana", "Esta semana", "Después"] as const;
type GroupLabel = (typeof GROUP_LABELS)[number];

export function AgendaView({
  rangeDays = 30,
  onDayClick,
  onEventClick,
}: {
  /** Cuántos días hacia adelante (desde hoy) agrupar. */
  rangeDays?: number;
  onDayClick?: (date: string) => void;
  onEventClick?: (ev: CalendarEvent) => void;
}) {
  const { today, visibleEvents } = useCalendarEngine();

  const groups = useMemo(() => {
    const tomorrow = addDays(today, 1);
    const weekEnd = addDays(today, 7);
    const rangeEnd = addDays(today, rangeDays);

    const byDay = new Map<string, CalendarEvent[]>();
    for (const ev of visibleEvents) {
      const s = ev.start.slice(0, 10), e = ev.end.slice(0, 10);
      let d = s < today ? today : s;
      let guard = 0;
      while (d <= e && d <= rangeEnd && guard < rangeDays + 5) {
        if (d >= today) {
          const list = byDay.get(d) ?? [];
          list.push(ev);
          byDay.set(d, list);
        }
        d = addDays(d, 1);
        guard++;
      }
    }

    const groupOf = (date: string): GroupLabel =>
      date === today ? "Hoy" : date === tomorrow ? "Mañana" : date <= weekEnd ? "Esta semana" : "Después";

    const out = new Map<GroupLabel, { date: string; events: CalendarEvent[] }[]>();
    for (const label of GROUP_LABELS) out.set(label, []);
    const days = Array.from(byDay.keys()).sort();
    for (const date of days) {
      const events = (byDay.get(date) ?? []).sort((a, b) => {
        if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
        return a.start.localeCompare(b.start);
      });
      out.get(groupOf(date))!.push({ date, events });
    }
    return out;
  }, [visibleEvents, today, rangeDays]);

  const hasAny = Array.from(groups.values()).some((g) => g.length > 0);

  if (!hasAny) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-2xl grid place-items-center mb-4 mx-auto" style={{ background: "var(--ok-tint)" }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--ok)" }}>
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
        </div>
        <p className="text-[16px] font-semibold text-text-1 mb-1">Tu agenda está libre</p>
        <p className="text-[13px]" style={{ color: "var(--text-3)" }}>Sin eventos en los próximos {rangeDays} días.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {GROUP_LABELS.map((label) => {
        const days = groups.get(label) ?? [];
        if (days.length === 0) return null;
        return (
          <div key={label}>
            <p className="text-[11px] font-bold uppercase tracking-wider mb-2 px-1" style={{ color: "var(--text-3)" }}>{label}</p>
            <div className="flex flex-col gap-1">
              {days.map(({ date, events }) => (
                <div key={date} className="rounded-xl overflow-hidden" style={{ background: "var(--surface)" }}>
                  <button type="button" onClick={() => onDayClick?.(date)}
                    className="w-full text-left px-4 py-2.5 transition-colors hover:bg-hover"
                    style={{ borderBottom: events.length > 0 ? "1px solid var(--border)" : "none" }}>
                    <p className="text-[13px] font-bold capitalize">{dayLongLabel(date)}</p>
                  </button>
                  {events.length > 0 && (
                    <div className="flex flex-col">
                      {events.map((ev, idx) => (
                        <button key={ev.id} type="button" onClick={() => onEventClick?.(ev)}
                          className="flex items-center gap-3 text-left px-4 py-2.5 transition-all hover:bg-hover"
                          style={{ 
                            borderBottom: idx < events.length - 1 ? "1px solid var(--border)" : "none"
                          }}>
                          <span className="w-12 shrink-0 text-[12px] font-semibold tabular-nums" style={{ color: ev.allDay ? "var(--text-3)" : "var(--text-2)" }}>
                            {ev.allDay ? "Todo el día" : ev.start.slice(11, 16)}
                          </span>
                          <span className="w-1 self-stretch rounded-full shrink-0" style={{ background: eventColor(ev.kind), minHeight: 16 }} />
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13px] font-semibold truncate" style={{ color: "var(--text-1)" }}>{ev.title}</span>
                            <span className="block text-[11px] mt-0.5" style={{ color: "var(--text-3)" }}>{eventLabel(ev.kind)}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
