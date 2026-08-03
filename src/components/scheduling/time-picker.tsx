"use client";
/* ═══════════════════════════════════════════════════════════════
   EMET Scheduling System · time-picker
   TimePicker con ruedas tipo iOS (hora · minuto · AM/PM) — MISMA API
   pública que el anterior (components/select.tsx). Cambios del brief:
   - SE ELIMINÓ el buscador ("La mayoría nunca busca").
   - En su lugar: filtros rápidos Mañana · Tarde · Noche (+ Ahora), y
     "Disponible" SOLO si se pasa la lista de disponibilidad.
   - Ruedas iOS: actualizan en vivo al girar, con máscara de gradiente,
     línea central y snap por opción. Minutos SOLO cada stepMin.
   ═══════════════════════════════════════════════════════════════ */
import { useEffect, useRef, useState } from "react";
import { fmtTime } from "@/lib/hours";
import { nowMeridaTime } from "@/lib/tz";
import { IconClock, IconChevronDown } from "../icons";
import { SchedulingOverlay, cx } from "./primitives";

const pad2 = (n: number) => String(n).padStart(2, "0");

export function parseHHMM(value: string): { hour12: number; minute: number; meridiem: "AM" | "PM" } {
  const [h, m] = value.slice(0, 5).split(":").map(Number);
  const hour24 = Number.isFinite(h) ? h : 0;
  const minute = Number.isFinite(m) ? m : 0;
  return {
    hour12: hour24 % 12 === 0 ? 12 : hour24 % 12,
    minute,
    meridiem: hour24 < 12 ? "AM" : "PM",
  };
}

export function composeHHMM(hour12: number, minute: number, meridiem: "AM" | "PM") {
  const h24 = (hour12 % 12) + (meridiem === "PM" ? 12 : 0);
  return `${pad2(h24)}:${pad2(minute)}`;
}

/* Rueda individual: lista vertical con scroll-snap, máscara de gradiente y
   línea central. Dispara onChange solo al CRUZAR a otra opción (rAF-throttle). */
export function Wheel({
  items, value, onChange, itemH = 46, visible = 5,
}: {
  items: string[]; value: string; onChange: (v: string) => void; itemH?: number; visible?: number;
}) {
  const height = itemH * visible;
  const pad = (height - itemH) / 2;
  const ref = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);
  const raf = useRef<number | undefined>(undefined);

  useEffect(() => {
    const idx = items.findIndex((it) => it === value);
    if (idx < 0) return;
    const el = ref.current;
    if (!el) return;
    syncing.current = true;
    el.scrollTop = idx * itemH;
    const t = requestAnimationFrame(() => { syncing.current = false; });
    return () => cancelAnimationFrame(t);
  }, [value, items, itemH]);

  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current); }, []);

  const onScroll = () => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const el = ref.current;
      if (!el || syncing.current) return;
      const idx = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / itemH)));
      const next = items[idx];
      if (next !== value) onChange(next);
    });
  };

  return (
    <div className="relative select-none" style={{ height }}>
      <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2"
        style={{ height: itemH, background: "var(--surface-2)", borderRadius: 14 }} />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[2]" style={{ height: pad, background: "linear-gradient(to bottom, var(--panel) 55%, transparent)" }} />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2]" style={{ height: pad, background: "linear-gradient(to top, var(--panel) 55%, transparent)" }} />
      <div ref={ref} onScroll={onScroll} className="absolute inset-0 overflow-y-auto nx-scroll"
        style={{ scrollSnapType: "y mandatory", scrollbarWidth: "none" }}>
        <div style={{ paddingTop: pad, paddingBottom: pad }}>
          {items.map((it) => {
            const active = it === value;
            return (
              <div key={it} className="flex items-center justify-center"
                style={{
                  height: itemH,
                  scrollSnapAlign: "center",
                  fontSize: active ? 17 : 15,
                  fontWeight: active ? 700 : 500,
                  color: active ? "var(--text-1)" : "var(--text-3)",
                  transition: "font-size .12s ease, color .12s ease",
                }}>
                {it}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

type Band = { label: string; hour12: number; meridiem: "AM" | "PM" };

const BANDS: Band[] = [
  { label: "Mañana", hour12: 6, meridiem: "AM" },
  { label: "Tarde", hour12: 12, meridiem: "PM" },
  { label: "Noche", hour12: 6, meridiem: "PM" },
];

export function TimePicker({
  value, onChange, placeholder = "Seleccionar hora", className, disabled, stepMin = 10, title = "Selecciona una hora", availability,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string; disabled?: boolean;
  stepMin?: number; title?: string;
  /** Opcional: "HH:MM" disponibles. Si se pasa, aparece el filtro rápido
      "Disponible" que recorta las ruedas a solo esas horas. */
  availability?: Set<string>;
}) {
  const [open, setOpen] = useState(false);
  const [parts, setParts] = useState(() => parseHHMM(value || "08:00"));
  const [onlyFree, setOnlyFree] = useState(false);

  const minutes = Array.from({ length: 60 / stepMin }, (_, i) => pad2(i * stepMin));
  const hours = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
  const meridiem = ["AM", "PM"];

  const showFree = onlyFree && availability && availability.size > 0;
  const availableHourLabels = availability
    ? new Set(Array.from(availability, (t) => {
        const h24 = Number(t.slice(0, 2));
        return String(h24 % 12 === 0 ? 12 : h24 % 12);
      }))
    : null;
  const filteredHours = showFree && availableHourLabels ? hours.filter((h) => availableHourLabels.has(h)) : hours;
  const filteredMinutes = showFree && availability ? minutes.filter((mn) => {
    const h24 = (parts.hour12 % 12) + (parts.meridiem === "PM" ? 12 : 0);
    return availability.has(`${pad2(h24)}:${mn}`);
  }) : minutes;

  const emit = (next: typeof parts) => {
    setParts(next);
    const composed = composeHHMM(next.hour12, next.minute, next.meridiem);
    if (composed !== value) onChange(composed);
  };

  const snapToBand = (band: Band) => emit({ ...parts, hour12: band.hour12, meridiem: band.meridiem });

  const snapToNow = () => {
    const now = nowMeridaTime();
    const { hour12, minute, meridiem: md } = parseHHMM(now);
    const snapped = Math.floor(minute / stepMin) * stepMin;
    emit({ hour12, minute: snapped, meridiem: md });
  };

  return (
    <>
      <button
        type="button" disabled={disabled}
        onClick={() => { setParts(parseHHMM(value || "08:00")); setOnlyFree(false); setOpen(true); }}
        className={className ?? "field-input w-full flex items-center justify-between gap-2 text-left"}
      >
        <span className="flex items-center gap-2 min-w-0">
          <IconClock className="w-3.5 h-3.5 shrink-0 text-[var(--text-3)]" />
          <span className="truncate" style={{ color: value ? "var(--text-1)" : "var(--text-3)" }}>
            {value ? fmtTime(value) : placeholder}
          </span>
        </span>
        <IconChevronDown className="w-3.5 h-3.5 shrink-0 text-[var(--text-3)]" />
      </button>

      <SchedulingOverlay open={open} onClose={() => setOpen(false)} ariaLabel={title} width={344}>
        <div className="w-full flex flex-col gap-[18px]" style={{ padding: "28px 32px 20px" }}>
          <p className="text-[17px] font-semibold tracking-[-0.01em] text-[var(--text-1)]">{title}</p>

          {/* Filtros rápidos — reemplazan al buscador eliminado */}
          <div className="flex flex-wrap items-center gap-2">
            {BANDS.map((b) => {
              const active = parts.meridiem === b.meridiem && parts.hour12 === b.hour12;
              return (
                <button key={b.label} type="button" data-ripple onClick={() => snapToBand(b)}
                  className={cx(
                    "px-3.5 h-8 rounded-full text-[12.5px] font-semibold transition-colors",
                    active ? "text-[var(--accent)]" : "text-[var(--text-2)] hover:bg-[var(--surface-2)]"
                  )}
                  style={{ background: active ? "var(--accent-tint)" : "var(--surface-2)" }}>
                  {b.label}
                </button>
              );
            })}
            {availability && availability.size > 0 && (
              <button type="button" data-ripple onClick={() => { setOnlyFree((v) => !v); }}
                className={cx(
                  "px-3.5 h-8 rounded-full text-[12.5px] font-semibold transition-colors",
                  onlyFree ? "text-[var(--accent)]" : "text-[var(--text-2)] hover:bg-[var(--surface-2)]"
                )}
                style={{ background: onlyFree ? "var(--accent-tint)" : "var(--surface-2)" }}>
                Disponible
              </button>
            )}
            <button type="button" onClick={snapToNow}
              className="px-3.5 h-8 rounded-full text-[12.5px] font-semibold transition-colors text-[var(--text-2)] hover:bg-[var(--surface-2)]"
              style={{ background: "var(--surface-2)" }}>
              Ahora
            </button>
          </div>

          {/* Ruedas */}
          <div className="flex items-stretch justify-between w-full">
            <Wheel items={filteredHours} value={String(parts.hour12)} onChange={(v) => emit({ ...parts, hour12: Number(v) })} />
            <Wheel items={filteredMinutes} value={pad2(parts.minute)} onChange={(v) => emit({ ...parts, minute: Number(v) })} />
            <Wheel items={meridiem} value={parts.meridiem} onChange={(v) => emit({ ...parts, meridiem: v as "AM" | "PM" })} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 shrink-0" style={{ padding: "6px 32px 24px", borderTop: "0.5px solid var(--border)" }}>
          <button type="button" onClick={() => setOpen(false)} className="btn-tertiary h-9 px-4 rounded-full text-[13px]">
            Cancelar
          </button>
          <button type="button" onClick={() => setOpen(false)} className="btn-primary h-9 px-5 rounded-full text-[13px]">
            Listo
          </button>
        </div>
      </SchedulingOverlay>
    </>
  );
}
