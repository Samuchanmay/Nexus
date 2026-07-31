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
      <div className="card px-5 py-10 text-center">
        <p className="text-[14px] font-semibold">Tu agenda está libre.</p>
        <p className="text-[12.5px] mt-1" style={{ color: "var(--text-2)" }}>
          Sin eventos en los próximos {rangeDays} días.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {GROUP_LABELS.map((label) => {
        const days = groups.get(label) ?? [];
        if (days.length === 0) return null;
        return (
          <div key={label}>
            <p className="text-[12px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-3)" }}>{label}</p>
            <div className="card p-0 divide-y" style={{ borderColor: "var(--border)" }}>
              {days.map(({ date, events }) => (
                <div key={date} className="px-4 py-3">
                  <button type="button" onClick={() => onDayClick?.(date)}
                    className="text-[12.5px] font-bold capitalize mb-1.5 hover:underline">
                    {dayLongLabel(date)}
                  </button>
                  <div className="flex flex-col gap-1">
                    {events.map((ev) => (
                      <button key={ev.id} type="button" onClick={() => onEventClick?.(ev)}
                        className="flex items-center gap-2.5 text-left px-1.5 py-1 rounded-[6px] transition-colors hover:bg-hover">
                        <span className="w-10 shrink-0 text-[11px] font-semibold tabular-nums" style={{ color: "var(--text-3)" }}>
                          {ev.allDay ? "" : ev.start.slice(11, 16)}
                        </span>
                        <span className="w-1 self-stretch rounded-full shrink-0" style={{ background: eventColor(ev.kind), minHeight: 14 }} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-semibold truncate">{ev.title}</span>
                          <span className="block text-[11px]" style={{ color: "var(--text-2)" }}>{eventLabel(ev.kind)}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
