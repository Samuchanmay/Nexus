"use client";
import { useMemo } from "react";
import { addDays } from "@/lib/tz";
import { dayLongLabel } from "@/lib/calendar-core";
import type { CalendarEvent } from "./types";
import { eventColor, eventLabel } from "./types";
import { useCalendarEngine } from "./engine";

/* ── Calendar Engine · asistente de tiempo (EMET-CALENDAR-ENGINE.md §13) ──
   Panel derecho — NUNCA otro calendario. Lectura editorial: Hoy / Próximos
   (siguientes `upcomingDays` días) / un slot opcional para contenido propio
   de cada pantalla (ej. "2 solicitudes sin aprobar" en admin, algo que este
   componente genérico no conoce). En móvil no se monta — cada página decide
   dónde mostrarlo (o no) según el layout de ese breakpoint. */

export function CalendarRightPanel({
  upcomingDays = 7,
  upcomingLimit = 6,
  pendingSlot,
  onEventClick,
}: {
  upcomingDays?: number;
  upcomingLimit?: number;
  /** Contenido específico del dominio (ej. solicitudes por aprobar) — el
      panel es genérico y no conoce Supabase ni el resto de la app. */
  pendingSlot?: React.ReactNode;
  onEventClick?: (ev: CalendarEvent) => void;
}) {
  const { today, visibleEvents } = useCalendarEngine();

  const todayEvents = useMemo(() => visibleEvents
    .filter((ev) => today >= ev.start.slice(0, 10) && today <= ev.end.slice(0, 10))
    .sort((a, b) => (a.allDay === b.allDay ? a.start.localeCompare(b.start) : a.allDay ? -1 : 1)),
    [visibleEvents, today]);

  const upcoming = useMemo(() => {
    const rangeEnd = addDays(today, upcomingDays);
    return visibleEvents
      .filter((ev) => {
        const s = ev.start.slice(0, 10);
        return s > today && s <= rangeEnd;
      })
      .sort((a, b) => a.start.localeCompare(b.start))
      .slice(0, upcomingLimit);
  }, [visibleEvents, today, upcomingDays, upcomingLimit]);

  return (
    <div className="flex flex-col gap-6 w-full lg:w-[280px] shrink-0">
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: "var(--accent)" }}>Hoy</p>
          {todayEvents.length > 0 && (
            <span className="text-[12px] font-bold px-1.5 py-0.5 rounded-full tabular-nums" style={{ color: "var(--accent)", background: "var(--accent-tint)" }}>
              {todayEvents.length}
            </span>
          )}
        </div>
        {todayEvents.length === 0 ? (
          <p className="text-[12.5px] py-2" style={{ color: "var(--text-3)" }}>Tu día está libre.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {todayEvents.map((ev) => (
              <button key={ev.id} type="button" onClick={() => onEventClick?.(ev)}
                className="flex items-center gap-2.5 text-left px-2 py-2 rounded-[8px] border transition-colors hover:bg-hover"
                style={{ borderColor: "var(--border)" }}>
                <span className="w-9 shrink-0 text-[12px] font-semibold tabular-nums" style={{ color: "var(--text-3)" }}>
                  {ev.allDay ? "" : ev.start.slice(11, 16)}
                </span>
                <span className="w-1 self-stretch rounded-full shrink-0" style={{ background: eventColor(ev.kind), minHeight: 14 }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-semibold truncate">{ev.title}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: "var(--text-3)" }}>Próximos</p>
          {upcoming.length > 0 && (
            <span className="text-[12px] font-bold px-1.5 py-0.5 rounded-full tabular-nums" style={{ color: "var(--text-2)", background: "var(--surface-2)" }}>
              {upcoming.length}
            </span>
          )}
        </div>
        {upcoming.length === 0 ? (
          <p className="text-[12.5px] py-2" style={{ color: "var(--text-3)" }}>Nada en los próximos {upcomingDays} días.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {upcoming.map((ev) => (
              <button key={ev.id} type="button" onClick={() => onEventClick?.(ev)}
                className="flex items-center gap-2.5 text-left px-2 py-2 rounded-[8px] border transition-colors hover:bg-hover"
                style={{ borderColor: "var(--border)" }}>
                <span className="w-9 shrink-0 text-[12px] font-semibold tabular-nums" style={{ color: "var(--text-3)" }}>
                  {ev.start.slice(11, 16)}
                </span>
                <span className="w-1 self-stretch rounded-full shrink-0" style={{ background: eventColor(ev.kind), minHeight: 14 }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-semibold truncate">{ev.title}</span>
                  <span className="block text-[12px] capitalize" style={{ color: "var(--text-2)" }}>
                    {dayLongLabel(ev.start.slice(0, 10))} · {eventLabel(ev.kind)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {pendingSlot && (
        <div>
          <p className="text-[12px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-3)" }}>Pendientes</p>
          {pendingSlot}
        </div>
      )}
    </div>
  );
}
