"use client";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { MONTHS, DOW } from "@/lib/calendar-core";
import { buildMonthGrid, monthBounds, shiftMonth } from "@/lib/calendar-grid";
import { addDays } from "@/lib/tz";
import { useMountOnOpen } from "@/lib/use-mount-on-open";
import { IconCalendar } from "@/components/icons";

/* ── Calendar Engine · CalendarDatePicker (EMET-CALENDAR-ENGINE.md §12) ──
   Picker único del motor: atajos (Hoy/Mañana/Próxima semana/Próximo mes) +
   rejilla del mes. Aditivo — NO reemplaza a `date-sheet.tsx` (DatePicker/
   DateRangeField/DateRangeCalendar), que sigue siendo el picker en
   producción en los ~17 call sites existentes (vacaciones, solicitudes,
   días inhábiles, filtros…). Migrar esos call sites es trabajo de Fase C
   que requiere probarse en un navegador real uno por uno — no se hizo a
   ciegas en esta ronda. Este componente queda listo para adoptarse. */

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function CalendarDatePicker({
  value,
  onChange,
  placeholder = "Elegir fecha",
  label,
}: {
  value: string | null;
  onChange: (date: string) => void;
  placeholder?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const { mounted, visible } = useMountOnOpen(open, 180);
  const [ym, setYm] = useState((value ?? todayIso()).slice(0, 7));

  useEffect(() => {
    if (open) setYm((value ?? todayIso()).slice(0, 7));
  }, [open, value]);

  useEffect(() => {
    if (!mounted) return;
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [mounted]);

  const pick = (date: string) => { onChange(date); setOpen(false); };

  const shortcuts = useMemo(() => {
    const t = todayIso();
    const nextMonday = (() => {
      let d = addDays(t, 1);
      // ya cae en la próxima semana si hoy es viernes/sábado/domingo; si no,
      // "próxima semana" = lunes de la semana siguiente a la actual.
      while (new Date(`${d}T12:00:00`).getDay() !== 1) d = addDays(d, 1);
      return d;
    })();
    return [
      { label: "Hoy", date: t },
      { label: "Mañana", date: addDays(t, 1) },
      { label: "Próxima semana", date: nextMonday },
      { label: "Próximo mes", date: `${shiftMonth(t.slice(0, 7), 1)}-01` },
    ];
  }, []);

  const { first, last, daysInMonth, year, month } = monthBounds(ym);
  const cells = useMemo(() => buildMonthGrid(first, last, daysInMonth), [first, last, daysInMonth]);
  const today = todayIso();

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="field-input flex items-center gap-2 text-left w-full">
        <span className="shrink-0" style={{ color: "var(--text-3)" }}>
          <IconCalendar className="w-4 h-4" />
        </span>
        <span style={{ color: value ? "var(--text-1)" : "var(--text-3)" }}>
          {value ? value : placeholder}
        </span>
      </button>

      {mounted && createPortal(
        <div
          className="fixed inset-0 z-[600] grid place-items-center px-4 transition-opacity"
          style={{ background: "rgba(0,0,0,.42)", backdropFilter: "blur(18px) saturate(.75) brightness(.72)", WebkitBackdropFilter: "blur(18px) saturate(.75) brightness(.72)", opacity: visible ? 1 : 0 }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div
            className="w-full max-w-[340px] nx-pop"
            style={{
              background: "var(--surface)", border: "0.5px solid var(--border-2)",
              borderRadius: "var(--radius-l)", boxShadow: "var(--shadow-3)",
              transform: visible ? "none" : "translateY(8px) scale(.985)", opacity: visible ? 1 : 0,
            }}
            role="dialog" aria-modal="true" aria-label={label ?? "Elegir fecha"}
          >
            <div className="flex flex-wrap gap-1.5 p-3" style={{ borderBottom: "0.5px solid var(--border)" }}>
              {shortcuts.map((s) => (
                <button key={s.label} type="button" onClick={() => pick(s.date)}
                  className="px-2.5 py-1.5 rounded-full text-[12px] font-semibold transition-colors hover:bg-hover"
                  style={{ background: "var(--surface-2)", color: "var(--text-1)" }}>
                  {s.label}
                </button>
              ))}
            </div>

            <div className="p-3.5">
              <div className="flex items-center justify-between pb-2.5">
                <button type="button" onClick={() => setYm(shiftMonth(ym, -1))} aria-label="Mes anterior"
                  className="w-7 h-7 rounded-full grid place-items-center transition-colors hover:bg-hover"
                  style={{ color: "var(--text-2)" }}>‹</button>
                <p className="text-[13px] font-bold capitalize">{MONTHS[month - 1]} {year}</p>
                <button type="button" onClick={() => setYm(shiftMonth(ym, 1))} aria-label="Mes siguiente"
                  className="w-7 h-7 rounded-full grid place-items-center transition-colors hover:bg-hover"
                  style={{ color: "var(--text-2)" }}>›</button>
              </div>
              <div className="grid grid-cols-7 gap-0.5 mb-1">
                {DOW.map((d) => (
                  <span key={d} className="text-center text-[10.5px] font-bold" style={{ color: "var(--text-3)" }}>{d[0]}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {cells.map((c) => {
                  const isToday = c.date === today;
                  const isSelected = c.date === value;
                  return (
                    <button
                      key={c.date}
                      type="button"
                      onClick={() => pick(c.date)}
                      className="aspect-square rounded-[6px] text-[12px] tabular-nums transition-colors hover:bg-hover"
                      style={{
                        color: isToday ? "#fff" : c.inMonth ? (isSelected ? "var(--accent)" : "var(--text-1)") : "var(--text-3)",
                        background: isToday ? "var(--accent)" : isSelected ? "var(--accent-tint)" : "transparent",
                        opacity: c.inMonth ? 1 : 0.35,
                        fontWeight: isToday || isSelected ? 700 : 500,
                      }}
                    >
                      {c.day}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2 p-3" style={{ borderTop: "0.5px solid var(--border)" }}>
              <button type="button" onClick={() => setOpen(false)}
                className="btn-secondary flex-1 py-2 text-[13px]">Cancelar</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
