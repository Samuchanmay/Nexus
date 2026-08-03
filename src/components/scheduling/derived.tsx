"use client";
/* ═══════════════════════════════════════════════════════════════
   EMET Scheduling System · derived
   Pickers derivados del mismo motor (DateGrid + ruedas):
   - DateTimePicker: día + hora en un solo popover.
   - MonthPicker: "YYYY-MM" sobre grilla de 12 meses.
   - YearPicker: "YYYY" sobre grilla de años con navegación por década.
   - WeekPicker: selecciona la semana (Lun–Dom) que contiene el día elegido.
   Todos: MISMO shell SchedulingOverlay, MISMO lenguaje visual.
   ═══════════════════════════════════════════════════════════════ */
import { useMemo, useState } from "react";
import { todayMerida, shortDate } from "@/lib/tz";
import { MONTHS } from "@/lib/calendar-grid";
import { fmtTime } from "@/lib/hours";
import { IconCalendar, IconChevronDown, IconChevronLeft } from "../icons";
import { SchedulingOverlay, PickerFooter, cx } from "./primitives";
import { DateGrid } from "./date-grid";
import { Wheel, parseHHMM, composeHHMM } from "./time-picker";

const pad2 = (n: number) => String(n).padStart(2, "0");

/* ── DateTimePicker ── */
export function DateTimePicker({
  value, onChange, className, placeholder = "Selecciona fecha y hora", title = "Selecciona fecha y hora", stepMin = 10,
}: {
  value: string | null; onChange: (v: string) => void; className?: string;
  placeholder?: string; title?: string; stepMin?: number;
}) {
  const today = todayMerida();
  const [open, setOpen] = useState(false);
  const [pDate, setPDate] = useState(value?.slice(0, 10) ?? today);
  const [pTime, setPTime] = useState(value?.slice(11, 16) ?? "08:00");
  const [ym, setYm] = useState((value?.slice(0, 7)) ?? today.slice(0, 7));

  const parts = useMemo(() => parseHHMM(pTime), [pTime]);
  const minutes = useMemo(() => Array.from({ length: 60 / stepMin }, (_, i) => pad2(i * stepMin)), [stepMin]);
  const hours = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
  const meridiem = ["AM", "PM"];

  const setParts = (next: typeof parts) => {
    setPTime(composeHHMM(next.hour12, next.minute, next.meridiem));
  };

  const label = value ? `${shortDate(value)} · ${fmtTime(value.slice(11, 16))}` : "";

  return (
    <>
      <button type="button" onClick={() => { setPDate(value?.slice(0, 10) ?? today); setPTime(value?.slice(11, 16) ?? "08:00"); setYm((value?.slice(0, 7)) ?? today.slice(0, 7)); setOpen(true); }}
        className={className ?? "field-input w-full flex items-center justify-between gap-2 text-left"}>
        <span className="flex items-center gap-2 min-w-0">
          <IconCalendar className="w-3.5 h-3.5 shrink-0 text-[var(--text-3)]" />
          <span className="truncate" style={{ color: label ? "var(--text-1)" : "var(--text-3)" }}>{label || placeholder}</span>
        </span>
        <IconChevronDown className="w-3.5 h-3.5 shrink-0 text-[var(--text-3)]" />
      </button>

      <SchedulingOverlay open={open} onClose={() => setOpen(false)} ariaLabel={title} width={360}>
        <div className="flex flex-col min-h-0 flex-1">
          <div className="flex flex-col gap-[18px] overflow-y-auto nx-scroll min-h-0 flex-1" style={{ padding: "28px 32px 20px" }}>
            <DateGrid ym={ym} onYm={setYm} value={pDate} minDate={today} onPick={(d) => setPDate(d)} />
            <div className="flex items-stretch justify-between w-full" style={{ borderTop: "0.5px solid var(--border)" }}>
              <div className="pt-4 w-full flex justify-center gap-2">
                <Wheel items={hours} value={String(parts.hour12)} itemH={42} visible={4}
                  onChange={(v) => setParts({ ...parts, hour12: Number(v) })} />
                <Wheel items={minutes} value={pad2(parts.minute)} itemH={42} visible={4}
                  onChange={(v) => setParts({ ...parts, minute: Number(v) })} />
                <Wheel items={meridiem} value={parts.meridiem} itemH={42} visible={4}
                  onChange={(v) => setParts({ ...parts, meridiem: v as "AM" | "PM" })} />
              </div>
            </div>
          </div>
        </div>
        <PickerFooter
          onCancel={() => setOpen(false)}
          onToday={() => { setPDate(today); setYm(today.slice(0, 7)); }}
          onApply={() => { onChange(`${pDate}T${pTime}`); setOpen(false); }}
          applyLabel="Aplicar"
        />
      </SchedulingOverlay>
    </>
  );
}

/* ── MonthPicker ── */
export function MonthPicker({
  value, onChange, className, placeholder = "Seleccionar mes", title = "Selecciona un mes",
}: {
  value: string | null; onChange: (ym: string) => void; className?: string; placeholder?: string; title?: string;
}) {
  const today = todayMerida();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(Number(value?.slice(0, 4)) || Number(today.slice(0, 4)));

  const label = value ? `${MONTHS[Number(value.slice(5)) - 1]} ${value.slice(0, 4)}` : "";

  return (
    <>
      <button type="button" onClick={() => { setYear(Number(value?.slice(0, 4)) || Number(today.slice(0, 4))); setOpen(true); }}
        className={className ?? "field-input w-full flex items-center justify-between gap-2 text-left"}>
        <span className="flex items-center gap-2 min-w-0">
          <IconCalendar className="w-3.5 h-3.5 shrink-0 text-[var(--text-3)]" />
          <span className="truncate capitalize" style={{ color: label ? "var(--text-1)" : "var(--text-3)" }}>{label || placeholder}</span>
        </span>
        <IconChevronDown className="w-3.5 h-3.5 shrink-0 text-[var(--text-3)]" />
      </button>

      <SchedulingOverlay open={open} onClose={() => setOpen(false)} ariaLabel={title} width={360}>
        <div className="w-full flex flex-col gap-[18px]" style={{ padding: "28px 32px 32px" }}>
          <div className="flex items-center justify-between w-full">
            <button type="button" aria-label="Año anterior" onClick={() => setYear((y) => y - 1)}
              className="flex items-center justify-center rounded-full text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)] active:scale-95 transition"
              style={{ width: 36, height: 36 }}>
              <IconChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-[24px] font-semibold tracking-[-0.02em] text-[var(--text-1)]">{year}</div>
            <button type="button" aria-label="Año siguiente" onClick={() => setYear((y) => y + 1)}
              className="flex items-center justify-center rounded-full text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)] active:scale-95 transition"
              style={{ width: 36, height: 36 }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 w-full">
            {MONTHS.map((m, i) => {
              const ym = `${year}-${pad2(i + 1)}`;
              const selected = value === ym;
              const isCurrent = ym === today.slice(0, 7);
              return (
                <button key={m} type="button" data-ripple
                  onClick={() => { onChange(ym); setOpen(false); }}
                  className="relative flex items-center justify-center rounded-2xl text-[13.5px] font-semibold capitalize transition select-none"
                  style={{
                    height: 52,
                    background: selected ? "var(--accent)" : "var(--surface-2)",
                    color: selected ? "#fff" : isCurrent ? "var(--accent)" : "var(--text-1)",
                    boxShadow: selected ? "0 4px 14px rgba(0,102,255,.35)" : "none",
                  }}>
                  {m}
                  {isCurrent && !selected && (
                    <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full" style={{ width: 4, height: 4, background: "var(--accent)" }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </SchedulingOverlay>
    </>
  );
}

/* ── YearPicker ── */
export function YearPicker({
  value, onChange, className, placeholder = "Seleccionar año", title = "Selecciona un año",
}: {
  value: string | null; onChange: (y: string) => void; className?: string; placeholder?: string; title?: string;
}) {
  const today = todayMerida();
  const [open, setOpen] = useState(false);
  const [decade, setDecade] = useState(Math.floor((Number(value) || Number(today.slice(0, 4))) / 10) * 10);

  const years = Array.from({ length: 12 }, (_, i) => decade + i - 1);
  const label = value || "";

  return (
    <>
      <button type="button" onClick={() => { setDecade(Math.floor((Number(value) || Number(today.slice(0, 4))) / 10) * 10); setOpen(true); }}
        className={className ?? "field-input w-full flex items-center justify-between gap-2 text-left"}>
        <span className="flex items-center gap-2 min-w-0">
          <IconCalendar className="w-3.5 h-3.5 shrink-0 text-[var(--text-3)]" />
          <span className="truncate" style={{ color: label ? "var(--text-1)" : "var(--text-3)" }}>{label || placeholder}</span>
        </span>
        <IconChevronDown className="w-3.5 h-3.5 shrink-0 text-[var(--text-3)]" />
      </button>

      <SchedulingOverlay open={open} onClose={() => setOpen(false)} ariaLabel={title} width={360}>
        <div className="w-full flex flex-col gap-[18px]" style={{ padding: "28px 32px 32px" }}>
          <div className="flex items-center justify-between w-full">
            <button type="button" aria-label="Década anterior" onClick={() => setDecade((d) => d - 10)}
              className="flex items-center justify-center rounded-full text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)] active:scale-95 transition"
              style={{ width: 36, height: 36 }}>
              <IconChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-[24px] font-semibold tracking-[-0.02em] text-[var(--text-1)]">
              {decade} <span className="text-[var(--text-3)] font-medium">—</span> {decade + 9}
            </div>
            <button type="button" aria-label="Década siguiente" onClick={() => setDecade((d) => d + 10)}
              className="flex items-center justify-center rounded-full text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)] active:scale-95 transition"
              style={{ width: 36, height: 36 }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 w-full">
            {years.map((y) => {
              const ys = String(y);
              const selected = value === ys;
              const isCurrent = ys === today.slice(0, 4);
              return (
                <button key={ys} type="button" data-ripple
                  onClick={() => { onChange(ys); setOpen(false); }}
                  className={cx("relative flex items-center justify-center rounded-2xl text-[14px] font-semibold transition select-none",
                    selected ? "" : "hover:bg-[var(--surface-2)] active:scale-[.96]")}
                  style={{
                    height: 52,
                    background: selected ? "var(--accent)" : "var(--surface-2)",
                    color: selected ? "#fff" : isCurrent ? "var(--accent)" : "var(--text-1)",
                    boxShadow: selected ? "0 4px 14px rgba(0,102,255,.35)" : "none",
                    opacity: y === decade - 1 || y === decade + 10 ? 0.35 : 1,
                  }}>
                  {ys}
                </button>
              );
            })}
          </div>
        </div>
      </SchedulingOverlay>
    </>
  );
}

/* ── WeekPicker ── */
export function WeekPicker({
  value, onChange, className, placeholder = "Seleccionar semana", title = "Selecciona una semana",
}: {
  value: string | null; onChange: (iso: string) => void; className?: string; placeholder?: string; title?: string;
}) {
  const today = todayMerida();
  const [open, setOpen] = useState(false);
  const [ym, setYm] = useState((value ?? today).slice(0, 7));

  const label = value ? `Semana del ${shortDate(value)}` : "";

  return (
    <>
      <button type="button" onClick={() => { setYm((value ?? today).slice(0, 7)); setOpen(true); }}
        className={className ?? "field-input w-full flex items-center justify-between gap-2 text-left"}>
        <span className="flex items-center gap-2 min-w-0">
          <IconCalendar className="w-3.5 h-3.5 shrink-0 text-[var(--text-3)]" />
          <span className="truncate" style={{ color: label ? "var(--text-1)" : "var(--text-3)" }}>{label || placeholder}</span>
        </span>
        <IconChevronDown className="w-3.5 h-3.5 shrink-0 text-[var(--text-3)]" />
      </button>

      <SchedulingOverlay open={open} onClose={() => setOpen(false)} ariaLabel={title} width={360}>
        <div className="w-full" style={{ padding: "28px 32px 0" }}>
          <DateGrid
            ym={ym} onYm={setYm}
            value={value} highlightWeek={value}
            minDate={today}
            onPick={(d) => { onChange(d); setOpen(false); }}
          />
        </div>
        <PickerFooter onCancel={() => setOpen(false)} onApply={() => setOpen(false)} applyLabel="Listo" />
      </SchedulingOverlay>
    </>
  );
}
