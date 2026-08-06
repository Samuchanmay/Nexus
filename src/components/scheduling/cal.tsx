"use client";
/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   EMET Scheduling System Â· cal
   Pickers tipo Cal.com: recurrencia, zona horaria y disponibilidad.
   MISMO shell SchedulingOverlay y MISMO lenguaje visual que el resto.
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
import { useMemo, useState } from "react";
import { fmtTime } from "@/lib/hours";
import { IconChevronDown, IconSearch } from "../icons";
import { SchedulingOverlay, cx } from "./primitives";
import { Wheel } from "./time-picker";

const pad2 = (n: number) => String(n).padStart(2, "0");

/* â”€â”€ RecurrencePicker â”€â”€ */
export type RecurrenceFreq = "none" | "daily" | "weekly" | "monthly" | "yearly";

export type RecurrenceValue = {
  freq: RecurrenceFreq;
  interval: number;
  /** NÃºmero de ocurrencias (null = sin fin). */
  endAfter: number | null;
  /** Fecha de fin (null = sin fin). */
  endDate: string | null;
};

const FREQ_LABEL: Record<RecurrenceFreq, string> = {
  none: "Nunca",
  daily: "Diaria",
  weekly: "Semanal",
  monthly: "Mensual",
  yearly: "Anual",
};

const DOW = ["Dom", "Lun", "Mar", "MiÃ©", "Jue", "Vie", "SÃ¡b"];

export function RecurrencePicker({
  value, onChange, className, placeholder = "Sin repeticiÃ³n", title = "RepeticiÃ³n",
}: {
  value: RecurrenceValue; onChange: (v: RecurrenceValue) => void; className?: string;
  placeholder?: string; title?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<RecurrenceValue>(value);

  const label = value.freq === "none"
    ? placeholder
    : `${FREQ_LABEL[value.freq]}${value.interval > 1 ? ` Â· cada ${value.interval}` : ""}`;

  const set = (patch: Partial<RecurrenceValue>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <>
      <button type="button" onClick={() => { setDraft(value); setOpen(true); }}
        className={className ?? "field-input w-full flex items-center justify-between gap-2 text-left"}>
        <span className="flex items-center gap-2 min-w-0">
          <span className="truncate" style={{ color: value.freq !== "none" ? "var(--text-1)" : "var(--text-3)" }}>
            {label}
          </span>
        </span>
        <IconChevronDown className="w-3.5 h-3.5 shrink-0 text-[var(--text-3)]" />
      </button>

      <SchedulingOverlay open={open} onClose={() => setOpen(false)} ariaLabel={title} width={360}>
        <div className="w-full flex flex-col gap-5" style={{ padding: "28px 32px 26px" }}>
          <p className="text-[16px] font-semibold tracking-[-0.01em] text-[var(--text-1)]">{title}</p>

          <div className="flex flex-wrap gap-2">
            {(Object.keys(FREQ_LABEL) as RecurrenceFreq[]).map((f) => {
              const active = draft.freq === f;
              return (
                <button key={f} type="button" data-ripple onClick={() => set({ freq: f })}
                  className={cx("px-3.5 h-8 rounded-full text-[12.5px] font-semibold transition-colors",
                    active ? "text-[var(--accent)]" : "text-[var(--text-2)] hover:bg-[var(--surface-2)]")}
                  style={{ background: active ? "var(--accent-tint)" : "var(--surface-2)" }}>
                  {FREQ_LABEL[f]}
                </button>
              );
            })}
          </div>

          {draft.freq !== "none" && (
            <>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13.5px] font-semibold text-[var(--text-1)]">Cada</span>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => set({ interval: Math.max(1, draft.interval - 1) })}
                    className="w-8 h-8 rounded-full text-[16px] font-semibold text-[var(--text-2)] hover:bg-[var(--surface-2)]">âˆ’</button>
                  <span className="w-9 text-center text-[15px] font-bold text-[var(--text-1)]">{draft.interval}</span>
                  <button type="button" onClick={() => set({ interval: draft.interval + 1 })}
                    className="w-8 h-8 rounded-full text-[16px] font-semibold text-[var(--text-2)] hover:bg-[var(--surface-2)]">+</button>
                </div>
                <span className="text-[13.5px] font-semibold text-[var(--text-1)] capitalize">
                  {draft.freq === "daily" ? "dÃ­as" : draft.freq === "weekly" ? "semanas" : draft.freq === "monthly" ? "meses" : "aÃ±os"}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-[13.5px] font-semibold text-[var(--text-1)]">Fin</span>
                <div className="flex gap-2">
                  <button type="button" data-ripple onClick={() => set({ endAfter: null, endDate: null })}
                    className={cx("px-3 h-8 rounded-full text-[12.5px] font-semibold transition-colors",
                      !draft.endAfter && !draft.endDate ? "text-[var(--accent)]" : "text-[var(--text-2)] hover:bg-[var(--surface-2)]")}
                    style={{ background: !draft.endAfter && !draft.endDate ? "var(--accent-tint)" : "var(--surface-2)" }}>
                    Sin fin
                  </button>
                  <button type="button" data-ripple onClick={() => set({ endDate: null, endAfter: draft.endAfter ?? 10 })}
                    className={cx("px-3 h-8 rounded-full text-[12.5px] font-semibold transition-colors",
                      draft.endAfter ? "text-[var(--accent)]" : "text-[var(--text-2)] hover:bg-[var(--surface-2)]")}
                    style={{ background: draft.endAfter ? "var(--accent-tint)" : "var(--surface-2)" }}>
                    Tras {draft.endAfter ?? 10} veces
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 shrink-0" style={{ padding: "6px 32px 24px", borderTop: "0.5px solid var(--border)" }}>
          <button type="button" onClick={() => setOpen(false)} className="btn-tertiary h-9 px-4 rounded-full text-[13.5px]">Cancelar</button>
          <button type="button" onClick={() => { onChange(draft); setOpen(false); }} className="btn-primary h-9 px-5 rounded-full text-[13.5px]">Aplicar</button>
        </div>
      </SchedulingOverlay>
    </>
  );
}

/* â”€â”€ TimezonePicker â”€â”€ */
function offsetFor(tz: string): string {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" });
    const parts = fmt.formatToParts(new Date());
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

export function TimezonePicker({
  value, onChange, className, placeholder = "Seleccionar zona", title = "Zona horaria",
}: {
  value: string; onChange: (v: string) => void; className?: string; placeholder?: string; title?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const zones = useMemo(() => {
    const all = (typeof Intl !== "undefined" && typeof (Intl as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf === "function")
      ? (Intl as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf("timeZone")
      : ["America/Merida", "America/Mexico_City", "America/Argentina/Buenos_Aires", "America/Bogota", "America/Lima", "America/Santiago", "America/New_York", "Europe/Madrid"];
    return all.map((z) => ({ value: z, label: z, offset: offsetFor(z) }));
  }, []);

  const filtered = useMemo(() => {
    if (!q.trim()) return zones;
    const needle = q.trim().toLowerCase();
    return zones.filter((z) => z.label.toLowerCase().includes(needle));
  }, [zones, q]);

  return (
    <>
      <button type="button" onClick={() => { setQ(""); setOpen(true); }}
        className={className ?? "field-input w-full flex items-center justify-between gap-2 text-left"}>
        <span className="flex items-center gap-2 min-w-0">
          <span className="truncate" style={{ color: value ? "var(--text-1)" : "var(--text-3)" }}>{value || placeholder}</span>
        </span>
        <IconChevronDown className="w-3.5 h-3.5 shrink-0 text-[var(--text-3)]" />
      </button>

      <SchedulingOverlay open={open} onClose={() => setOpen(false)} ariaLabel={title} width={400}>
        <div className="w-full flex flex-col" style={{ padding: "28px 28px 0", minHeight: 0 }}>
          <p className="text-[16px] font-semibold tracking-[-0.01em] text-[var(--text-1)] mb-4">{title}</p>
          <div className="relative mb-3">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-3)]" />
            {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar zonaâ€¦"
              className="field-input pl-9 w-full" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto nx-scroll min-h-0 px-2 pb-3" style={{ maxHeight: 300 }}>
          {filtered.length === 0 ? (
            <p className="text-[13.5px] text-center py-8" style={{ color: "var(--text-3)" }}>Sin resultados</p>
          ) : (
            filtered.map((z) => (
              <button key={z.value} type="button" onClick={() => { onChange(z.value); setOpen(false); }}
                className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-sm text-left transition-colors hover:bg-hover">
                <span className="text-[13.5px] font-semibold truncate" style={{ color: "var(--text-1)" }}>{z.label}</span>
                <span className="text-[12px] shrink-0" style={{ color: "var(--text-3)" }}>{z.offset}</span>
              </button>
            ))
          )}
        </div>
      </SchedulingOverlay>
    </>
  );
}

/* â”€â”€ AvailabilityPicker â”€â”€ */
export type AvailabilityDay = { on: boolean; start: string; end: string };
export type AvailabilityValue = Record<string, AvailabilityDay>;

export function AvailabilityPicker({
  value, onChange, className, placeholder = "Configurar disponibilidad", title = "Disponibilidad",
}: {
  value: AvailabilityValue; onChange: (v: AvailabilityValue) => void; className?: string;
  placeholder?: string; title?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<AvailabilityValue>(value);
  const [expanded, setExpanded] = useState<number | null>(null);

  const dayKeys = ["0", "1", "2", "3", "4", "5", "6"]; // Dom..SÃ¡b (getDay)
  const activeCount = dayKeys.filter((k) => draft[k]?.on ?? false).length;
  const label = activeCount > 0 ? `${activeCount} dÃ­a${activeCount !== 1 ? "s" : ""}` : placeholder;

  const setDay = (key: string, patch: Partial<AvailabilityDay>) =>
    setDraft((d) => {
      const existing = d[key];
      const base: AvailabilityDay = existing ?? { on: false, start: "09:00", end: "18:00" };
      const next = { ...base, ...patch };
      if (!existing && !("on" in patch)) next.on = true;
      return { ...d, [key]: next };
    });

  const stepMin = 5;
  const minutes = useMemo(() => Array.from({ length: 60 / stepMin }, (_, i) => pad2(i * stepMin)), [stepMin]);
  const hours = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
  const meridiem = ["AM", "PM"];

  const fromParts = (v: string) => {
    const h = Number(v.slice(0, 2));
    return { hour12: h % 12 === 0 ? 12 : h % 12, meridiem: h < 12 ? "AM" : "PM" };
  };
  const compose = (hour12: number, meridiem: string, minute: number) => {
    const h24 = (hour12 % 12) + (meridiem === "PM" ? 12 : 0);
    return `${pad2(h24)}:${pad2(minute)}`;
  };

  return (
    <>
      <button type="button" onClick={() => { setDraft(value); setExpanded(null); setOpen(true); }}
        className={className ?? "field-input w-full flex items-center justify-between gap-2 text-left"}>
        <span className="truncate" style={{ color: activeCount > 0 ? "var(--text-1)" : "var(--text-3)" }}>{label}</span>
        <IconChevronDown className="w-3.5 h-3.5 shrink-0 text-[var(--text-3)]" />
      </button>

      <SchedulingOverlay open={open} onClose={() => setOpen(false)} ariaLabel={title} width={380}>
        <div className="w-full flex flex-col gap-4" style={{ padding: "28px 28px 18px" }}>
          <p className="text-[16px] font-semibold tracking-[-0.01em] text-[var(--text-1)]">{title}</p>
        </div>
        <div className="flex-1 overflow-y-auto nx-scroll min-h-0 px-2 pb-2" style={{ maxHeight: 320 }}>
          {dayKeys.map((key, i) => {
            const day = draft[key] ?? { on: false, start: "09:00", end: "18:00" };
            const isOpen = expanded === i;
            const baseS = fromParts(day.start);
            const baseE = fromParts(day.end);
            return (
              <div key={key} className="mb-1">
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-sm">
                  <button type="button" onClick={() => { setDay(key, { on: !day.on }); if (day.on) setExpanded(null); }}
                    aria-pressed={day.on}
                    className="relative shrink-0 rounded-full transition-colors"
                    style={{ width: 38, height: 22, background: day.on ? "var(--accent)" : "var(--surface-3)" }}>
                    <span className="absolute top-[2px] rounded-full transition-all"
                      style={{ left: day.on ? 18 : 2, width: 18, height: 18, background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.25)" }} />
                  </button>
                  <button type="button" onClick={() => setExpanded(isOpen ? null : i)}
                    className="flex-1 flex items-center justify-between gap-2 text-left">
                    <span className="text-[14px] font-semibold text-[var(--text-1)]">{DOW[i]}</span>
                    {day.on && (
                      <span className="text-[12.5px] font-medium text-[var(--text-2)]">
                        {fmtTime(day.start)} â€” {fmtTime(day.end)}
                      </span>
                    )}
                  </button>
                </div>

                {isOpen && day.on && (
                  <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-1">
                    <div className="flex items-center gap-1">
                      <span className="text-[12px] font-semibold uppercase tracking-wide text-[var(--text-3)] mr-1">Inicio</span>
                      <Wheel items={hours} value={String(baseS.hour12)} itemH={34} visible={3}
                        onChange={(v) => setDay(key, { start: compose(Number(v), baseS.meridiem, Number(day.start.slice(3, 5))) })} />
                      <Wheel items={minutes} value={pad2(Number(day.start.slice(3, 5)))} itemH={34} visible={3}
                        onChange={(v) => setDay(key, { start: compose(baseS.hour12, baseS.meridiem, Number(v)) })} />
                      <Wheel items={meridiem} value={baseS.meridiem} itemH={34} visible={3}
                        onChange={(v) => setDay(key, { start: compose(baseS.hour12, v, Number(day.start.slice(3, 5))) })} />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[12px] font-semibold uppercase tracking-wide text-[var(--text-3)] mr-1">Fin</span>
                      <Wheel items={hours} value={String(baseE.hour12)} itemH={34} visible={3}
                        onChange={(v) => setDay(key, { end: compose(Number(v), baseE.meridiem, Number(day.end.slice(3, 5))) })} />
                      <Wheel items={minutes} value={pad2(Number(day.end.slice(3, 5)))} itemH={34} visible={3}
                        onChange={(v) => setDay(key, { end: compose(baseE.hour12, baseE.meridiem, Number(v)) })} />
                      <Wheel items={meridiem} value={baseE.meridiem} itemH={34} visible={3}
                        onChange={(v) => setDay(key, { end: compose(baseE.hour12, v, Number(day.end.slice(3, 5))) })} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-end gap-2 shrink-0" style={{ padding: "6px 28px 24px", borderTop: "0.5px solid var(--border)" }}>
          <button type="button" onClick={() => setOpen(false)} className="btn-tertiary h-9 px-4 rounded-full text-[13.5px]">Cancelar</button>
          <button type="button" onClick={() => { onChange(draft); setOpen(false); }} className="btn-primary h-9 px-5 rounded-full text-[13.5px]">Aplicar</button>
        </div>
      </SchedulingOverlay>
    </>
  );
}

