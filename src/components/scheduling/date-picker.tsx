"use client";
/* ═══════════════════════════════════════════════════════════════
   EMET Scheduling System · date-picker
   DateField (input con máscara) + DatePicker (día único) +
   DateRangeField (rango con popover) + DateRangeCalendar (rango
   embebido). MISMA API pública que el componente anterior
   (components/date-sheet.tsx): todos los call sites siguen funcionando.

   Cambios de lenguaje respecto al anterior:
   - Shell SIEMPRE centrado (SchedulingOverlay) — se eliminó el modo
     "bottom sheet" móvil con grab-handle: rompía el lenguaje EMET.
   - Radio 24px, padding interior 28-32px.
   - Mes+año 24px semibold, flechas en botones circulares de 36px.
   - Días 44px, selección = fondo sólido --accent, hoy = punto inferior.
   - Cambio de mes animado (emet-month-in).
   ═══════════════════════════════════════════════════════════════ */
import { useEffect, useRef, useState } from "react";
import { addDays, todayMerida, dmy } from "@/lib/tz";
import { IconCalendar } from "../icons";
import { SchedulingOverlay, PickerFooter } from "./primitives";
import { DateGrid, type RangeState } from "./date-grid";

/* ── DateField: input con máscara dd/mm/aaaa. Valor ISO en/salida. ── */
export function DateField({ value, onChange, className, placeholder = "dd/mm/aaaa" }: {
  value: string; onChange: (iso: string) => void; className?: string; placeholder?: string;
}) {
  // dd/mm/aaaa — mismo helper único que el resto de EMET (§171/172).
  const [text, setText] = useState(value ? dmy(value) : "");
  useEffect(() => { setText(value ? dmy(value) : ""); }, [value]);

  const handle = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    let out = digits;
    if (digits.length > 4) out = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    else if (digits.length > 2) out = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    setText(out);
    if (digits.length === 8) {
      const d = digits.slice(0, 2), m = digits.slice(2, 4), y = digits.slice(4, 8);
      const iso = `${y}-${m}-${d}`;
      const dt = new Date(`${iso}T12:00:00`);
      if (!isNaN(dt.getTime()) && dt.getUTCDate() === Number(d) && dt.getUTCMonth() + 1 === Number(m)) {
        onChange(iso);
      }
    } else if (value) {
      onChange("");
    }
  };

  return (
    <input
      className={className ?? "field-input"} placeholder={placeholder} value={text}
      onChange={(e) => handle(e.target.value)} inputMode="numeric" maxLength={10}
    />
  );
}

/* Navegación por teclado dentro de una grilla abierta: flechas mueven el
   foco (anillo), Enter confirma, ESC cierra (lo hace el shell). */
function useGridKeys({
  open, focused, onMove, onEnter,
}: {
  open: boolean; focused: string; ym: string;
  onMove: (next: string, nextYm: string) => void;
  onEnter: (iso: string) => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        const delta = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" ? -7 : 7;
        const next = addDays(focused, delta);
        onMove(next, next.slice(0, 7));
      } else if (e.key === "Enter") {
        e.preventDefault();
        onEnter(focused);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, focused, onMove, onEnter]);
}

const dmyFull = (iso: string | null) => (iso ? dmy(iso) : "");

/* ── DatePicker: día único. ── */
export function DatePicker({ value, onChange, placeholder = "dd/mm/aaaa", className, minDate, maxDate, disabled }: {
  value: string; onChange: (iso: string) => void; placeholder?: string; className?: string;
  minDate?: string; maxDate?: string; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const todayIso = todayMerida();
  const [pending, setPending] = useState(value || "");
  const [ym, setYm] = useState((value || minDate || todayIso).slice(0, 7));
  const [focused, setFocused] = useState(value || minDate || todayIso);
  const wrapRef = useRef<HTMLDivElement>(null);

  const isBlocked = (date: string) => (!!minDate && date < minDate) || (!!maxDate && date > maxDate);

  const openSheet = () => {
    const start = value || minDate || todayIso;
    setPending(value || "");
    setYm(start.slice(0, 7));
    setFocused(start);
    setOpen(true);
  };

  useGridKeys({
    open,
    focused,
    ym,
    onMove: (next, nextYm) => { setFocused(next); if (nextYm !== ym) setYm(nextYm); },
    onEnter: (iso) => { if (!isBlocked(iso)) setPending(iso); },
  });

  return (
    <div className="relative" ref={wrapRef}>
      <div className="relative">
        <DateField value={value} onChange={onChange} className={className} placeholder={placeholder} />
        <button type="button" disabled={disabled} onClick={openSheet}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-sm transition-colors hover:bg-hover"
          style={{ color: "var(--text-3)" }} aria-label="Abrir calendario">
          <IconCalendar className="w-[15px] h-[15px]" />
        </button>
      </div>
      <SchedulingOverlay open={open} onClose={() => setOpen(false)} ariaLabel="Seleccionar fecha" width={360}>
        <div className="w-full" style={{ padding: "28px 32px 0" }}>
          <DateGrid
            ym={ym} onYm={setYm} value={pending} isBlocked={isBlocked} focused={focused}
            onPick={(date) => { if (!isBlocked(date)) { setPending(date); setFocused(date); } }}
          />
        </div>
        <PickerFooter
          onCancel={() => setOpen(false)}
          onToday={() => { if (!isBlocked(todayIso)) { setPending(todayIso); setFocused(todayIso); setYm(todayIso.slice(0, 7)); } }}
          onApply={() => { onChange(pending); setOpen(false); }}
        />
      </SchedulingOverlay>
    </div>
  );
}

/* ── DateRangeField: rango con popover — formularios compactos. ── */
export function DateRangeField({
  start, end, onSelect, placeholder = "Selecciona un rango", className, minDate, disabledDates, holidays,
}: {
  start: string | null; end: string | null; onSelect: (start: string | null, end: string | null) => void;
  placeholder?: string; className?: string; minDate?: string;
  disabledDates?: Set<string>; holidays?: Set<string>;
}) {
  const [open, setOpen] = useState(false);
  const todayIso = todayMerida();
  const [pStart, setPStart] = useState<string | null>(start);
  const [pEnd, setPEnd] = useState<string | null>(end);
  const [ym, setYm] = useState((start ?? minDate ?? todayIso).slice(0, 7));
  const [focused, setFocused] = useState(start ?? minDate ?? todayIso);
  const wrapRef = useRef<HTMLDivElement>(null);

  const isBlocked = (date: string) => (!!minDate && date < minDate) || !!holidays?.has(date) || !!disabledDates?.has(date);

  const label = start && end ? `${dmyFull(start)} — ${dmyFull(end)}` : start ? `${dmyFull(start)} — …` : "";

  const pick = (date: string) => {
    if (isBlocked(date)) return;
    if (!pStart || (pStart && pEnd)) { setPStart(date); setPEnd(null); return; }
    if (date < pStart) { setPStart(date); setPEnd(null); return; }
    setPEnd(date);
  };

  useGridKeys({
    open,
    focused,
    ym,
    onMove: (next, nextYm) => { setFocused(next); if (nextYm !== ym) setYm(nextYm); },
    onEnter: pick,
  });

  return (
    <div className="relative" ref={wrapRef}>
      <button type="button" onClick={() => { setPStart(start); setPEnd(end); const at = start ?? minDate ?? todayIso; setYm(at.slice(0, 7)); setFocused(at); setOpen(true); }}
        className={className ?? "field-input w-full text-left flex items-center justify-between gap-2"}>
        <span style={{ color: label ? "var(--text-1)" : "var(--text-3)" }}>{label || placeholder}</span>
        <span className="shrink-0" style={{ color: "var(--text-3)" }}><IconCalendar className="w-[15px] h-[15px]" /></span>
      </button>
      <SchedulingOverlay open={open} onClose={() => setOpen(false)} ariaLabel="Selecciona el rango" width={360}>
        <div className="w-full" style={{ padding: "28px 32px 0" }}>
          <DateGrid
            ym={ym} onYm={setYm} range={{ start: pStart, end: pEnd } satisfies RangeState}
            isBlocked={isBlocked} focused={focused} onPick={pick}
          />
        </div>
        <PickerFooter
          onCancel={() => setOpen(false)}
          onToday={() => { if (!isBlocked(todayIso)) { setFocused(todayIso); setYm(todayIso.slice(0, 7)); } }}
          onApply={() => { onSelect(pStart, pEnd); setOpen(false); }}
        />
      </SchedulingOverlay>
    </div>
  );
}

/* ── DateRangeCalendar: misma grilla, embebida SIN cáscara — para rangos
   que ya viven dentro de un Sheet propio (solicitar vacaciones). ── */
export function DateRangeCalendar({
  start, end, onSelect, holidays, disabledDates, minDate, legend = true,
}: {
  start: string | null; end: string | null;
  onSelect: (start: string | null, end: string | null) => void;
  holidays?: Set<string>; disabledDates?: Set<string>; minDate?: string; legend?: boolean;
}) {
  const todayIso = todayMerida();
  const [ym, setYm] = useState((start ?? todayIso).slice(0, 7));

  const isWeekend = (date: string) => { const dow = new Date(`${date}T12:00:00`).getDay(); return dow === 0 || dow === 6; };
  const isHoliday = (date: string) => holidays?.has(date) ?? false;
  const isTaken = (date: string) => disabledDates?.has(date) ?? false;
  const isPast = (date: string) => (minDate ? date < minDate : false);
  const isBlocked = (date: string) => isWeekend(date) || isHoliday(date) || isTaken(date) || isPast(date);

  const click = (date: string) => {
    if (isBlocked(date)) return;
    if (!start || (start && end)) { onSelect(date, null); return; }
    if (date < start) { onSelect(date, null); return; }
    onSelect(start, date);
  };

  return (
    <div className="overflow-hidden"
      style={{ borderRadius: 24, border: "0.5px solid var(--border)", background: "var(--surface)", padding: "24px 24px 18px" }}>
      <DateGrid ym={ym} onYm={setYm} range={{ start, end } satisfies RangeState} isBlocked={isBlocked} onPick={click} />
      {legend && (
        <div className="flex flex-wrap items-center gap-3 pt-4 text-[12px]" style={{ color: "var(--text-3)" }}>
          <span className="flex items-center gap-1.5">
            <i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "var(--accent)" }} /> Seleccionado
          </span>
          <span className="flex items-center gap-1.5">
            <i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "var(--accent-tint)" }} /> Rango
          </span>
          <span className="flex items-center gap-1.5">
            <i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "var(--danger-tint)" }} /> Festivo/Fin de semana
          </span>
          <span className="flex items-center gap-1.5">
            <i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "var(--warn-tint)" }} /> Ya tomado
          </span>
        </div>
      )}
    </div>
  );
}
