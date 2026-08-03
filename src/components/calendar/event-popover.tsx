"use client";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { dayLongLabel } from "@/lib/calendar-core";
import type { CalendarEvent } from "./types";
import { eventColor, eventLabel } from "./types";

/* ── Calendar Engine · popover de día ──
   (EMET-CALENDAR-ENGINE.md §9 CalendarEventPopover) — lista completa de los
   eventos de un día al tocar "+n" o el día mismo. Portado a document.body
   para nunca quedar detrás de un Sheet/Drawer (mismo estándar que el resto
   de overlays de EMET). Cierre: click fuera, ESC o el botón X. */

export function DayPopover({
  date, events, onClose, onEventClick,
}: {
  date: string;
  events: CalendarEvent[];
  onClose: () => void;
  onEventClick?: (ev: CalendarEvent) => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!mounted) return;
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const onDoc = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("[data-day-popover]")) return;
      onClose();
    };
    window.addEventListener("keydown", onEsc);
    document.addEventListener("mousedown", onDoc);
    return () => {
      window.removeEventListener("keydown", onEsc);
      document.removeEventListener("mousedown", onDoc);
    };
  }, [mounted, onClose]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[600] grid place-items-center px-4"
      style={{ background: "rgba(0,0,0,.42)", backdropFilter: "blur(18px) saturate(.75) brightness(.72)", WebkitBackdropFilter: "blur(18px) saturate(.75) brightness(.72)" }}>
      <div data-day-popover
        className="w-full max-w-[380px] max-h-[78vh] overflow-y-auto nx-pop"
        style={{ background: "var(--surface)", border: "0.5px solid var(--border-2)", borderRadius: "var(--radius-l)", boxShadow: "var(--shadow-3)" }}
        role="dialog" aria-modal="true" aria-label={dayLongLabel(date)}>
        <div className="flex items-start justify-between gap-2 px-5 pt-4 pb-2.5">
          <div className="min-w-0">
            <p className="text-[15px] font-bold tracking-tight capitalize truncate">{dayLongLabel(date)}</p>
            <p className="text-[12.5px] mt-0.5" style={{ color: "var(--text-2)" }}>
              {events.length} evento{events.length === 1 ? "" : "s"}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar"
            className="w-7 h-7 grid place-items-center rounded-full shrink-0 transition-colors hover:bg-hover"
            style={{ color: "var(--text-2)" }}>
            <svg viewBox="0 0 20 20" fill="none" className="w-3.5 h-3.5">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="px-3 pb-4 flex flex-col gap-1">
          {events.length === 0 && (
            <p className="text-[13px] py-4 text-center" style={{ color: "var(--text-3)" }}>Sin eventos este día.</p>
          )}
          {events.map((ev) => (
            <button
              key={ev.id}
              type="button"
              onClick={() => { onClose(); onEventClick?.(ev); }}
              className="flex items-start gap-2.5 w-full text-left px-2.5 py-2 rounded-sm transition-colors hover:bg-hover"
            >
              <span className="w-1 self-stretch rounded-full shrink-0 mt-0.5" style={{ background: eventColor(ev.kind) }} />
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-semibold truncate">{ev.title}</span>
                <span className="block text-[12px] mt-0.5" style={{ color: "var(--text-2)" }}>
                  {ev.user?.display_name ? `${ev.user.display_name} · ` : ""}{eventLabel(ev.kind)}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
