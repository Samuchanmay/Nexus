"use client";
/* ═══════════════════════════════════════════════════════════════
   EMET Scheduling System · date-grid
   MOTOR visual único que comparten DatePicker, DateRangePicker y
   cualquier picker de grilla mensual del sistema. No es un
   componente público: los pickers lo envuelven.

   Lenguaje del sistema (fijado en el brief):
   - Header mes+año 24-28px semibold, flechas en botones circulares de 36px.
   - Días en botones de 42-44px.
   - Día seleccionado = fondo sólido --accent (sin doble borde).
   - Hover = superficie sutil, no "card" rebuscada.
   - Hoy = punto pequeño inferior (no borde) + texto accent.
   - Rango = banda continua tipo Cal.com con extremos redondeados.
   - Cambio de mes = deslizamiento sutil + fade.
   - Selección con ripple suave (vía data-ripple global).
   ═══════════════════════════════════════════════════════════════ */
import { MONTHS, DOW, buildMonthGrid, monthBounds, shiftMonth } from "@/lib/calendar-grid";
import { addDays, todayMerida, isoWeekday } from "@/lib/tz";
import { cx } from "./primitives";

export const DAY_CELL = 44;

export type RangeState = { start: string | null; end: string | null };

function MonthNav({
  ym, onYm, canPrev, canNext,
}: {
  ym: string; onYm: (ym: string) => void; canPrev?: boolean; canNext?: boolean;
}) {
  const go = (dir: -1 | 1) => {
    onYm(shiftMonth(ym, dir));
  };

  return (
    <div className="flex items-center justify-between w-full">
      <button
        type="button"
        aria-label="Mes anterior"
        disabled={canPrev === false}
        onClick={() => go(-1)}
        className="flex items-center justify-center rounded-full text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)] active:scale-95 transition disabled:opacity-30 disabled:pointer-events-none"
        style={{ width: 36, height: 36 }}
      >
        <svg width="17" height="17" viewBox="0 0 16 16" fill="none">
          <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div className="text-[24px] font-semibold leading-none tracking-[-0.02em] text-[var(--text-1)] capitalize select-none">
        {MONTHS[Number(ym.slice(5)) - 1]}{" "}
        <span className="text-[var(--text-3)] font-medium">{ym.slice(0, 4)}</span>
      </div>

      <button
        type="button"
        aria-label="Mes siguiente"
        disabled={canNext === false}
        onClick={() => go(1)}
        className="flex items-center justify-center rounded-full text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)] active:scale-95 transition disabled:opacity-30 disabled:pointer-events-none"
        style={{ width: 36, height: 36 }}
      >
        <svg width="17" height="17" viewBox="0 0 16 16" fill="none">
          <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

/* Banda de rango tipo Cal.com: cada celda dibuja su "mitad" de la banda
   para que el color fluya continuo entre celdas adyacentes. */
function RangeBand({ left, right }: { left?: boolean; right?: boolean }) {
  return (
    <span
      className="absolute inset-y-[3px] z-0"
      style={{
        left: left ? 0 : "50%",
        right: right ? 0 : "50%",
        background: "var(--accent-tint)",
      }}
    />
  );
}

export function DayCell({
  iso, label, disabled, selected, isStart, isEnd, inRange, today, dim, focused, onClick,
}: {
  iso: string; label: string; disabled?: boolean; selected?: boolean;
  isStart?: boolean; isEnd?: boolean; inRange?: boolean; today?: boolean; dim?: boolean; focused?: boolean;
  onClick: (iso: string) => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      disabled={disabled}
      data-ripple
      onClick={() => onClick(iso)}
      className={cx(
        "relative flex items-center justify-center rounded-full text-[14px] select-none outline-none transition",
        "focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40",
        disabled
          ? "text-[var(--text-3)] opacity-40 cursor-not-allowed"
          : "text-[var(--text-1)] hover:bg-[var(--surface-2)] active:scale-[.92]"
      )}
      style={{
        width: "100%",
        height: DAY_CELL,
        background: selected ? "var(--accent)" : undefined,
        color: selected ? "#fff" : dim ? "var(--text-3)" : undefined,
        boxShadow: focused
          ? `0 0 0 2px var(--accent)${selected ? ", 0 4px 14px rgba(0,102,255,.35)" : ""}`
          : selected ? "0 4px 14px rgba(0,102,255,.35)" : undefined,
      }}
    >
      {inRange && !selected && <RangeBand left={!isStart} right={!isEnd} />}
      <span className="relative z-[1]">{label}</span>
      {today && !selected && (
        <span
          className="absolute bottom-[6px] left-1/2 -translate-x-1/2 z-[1] rounded-full"
          style={{ width: 4, height: 4, background: "var(--accent)" }}
        />
      )}
    </button>
  );
}

export function DateGrid({
  ym, onYm, value, onPick, range, minDate, maxDate, isBlocked, includeMonthEnds = true, focused, highlightWeek,
}: {
  ym: string; onYm: (ym: string) => void;
  value?: string | null; onPick?: (iso: string) => void;
  range?: RangeState;
  minDate?: string | null; maxDate?: string | null;
  isBlocked?: (iso: string) => boolean;
  includeMonthEnds?: boolean;
  /** Fecha con el anillo de foco de teclado (flechas), independiente de la
      selección — permite recorrer el mes sin alterar lo ya elegido. */
  focused?: string | null;
  /** ISO de cualquier día de la semana a resaltar con banda (Lun–Dom). */
  highlightWeek?: string | null;
}) {
  const today = todayMerida();
  const bounds = monthBounds(ym);
  const grid = buildMonthGrid(bounds.first, bounds.last, bounds.daysInMonth);

  const weekRange: RangeState | undefined = (() => {
    if (!highlightWeek) return undefined;
    const dow = isoWeekday(highlightWeek);
    const diff = dow === 0 ? -6 : 1 - dow; // lunes
    const start = addDays(highlightWeek, diff);
    return { start, end: addDays(start, 6) };
  })();

  const effectiveRange = range ?? weekRange;

  const block = (iso: string) => {
    if (isBlocked) return isBlocked(iso);
    if (minDate && iso < minDate) return true;
    if (maxDate && iso > maxDate) return true;
    return false;
  };

  const renderDay = (cell: { date: string; inMonth: boolean; day: number }) => {
    const iso = cell.date;
    const sel = value === iso;
    const inRange = effectiveRange
      ? effectiveRange.start && effectiveRange.end
        ? iso >= effectiveRange.start && iso <= effectiveRange.end
        : effectiveRange.start === iso
      : false;
    const isStart = !!effectiveRange?.start && iso === effectiveRange.start;
    const isEnd = !!effectiveRange?.end && iso === effectiveRange.end;
    return (
      <DayCell
        key={iso}
        iso={iso}
        label={String(cell.day)}
        today={today === iso}
        disabled={block(iso)}
        selected={sel}
        inRange={inRange}
        isStart={isStart}
        isEnd={isEnd}
        dim={!cell.inMonth}
        focused={focused === iso}
        onClick={onPick ? (i) => onPick(i) : () => {}}
      />
    );
  };

  return (
    <div className="flex flex-col gap-[18px] w-full">
      <MonthNav ym={ym} onYm={onYm} />

      <div
        key={ym}
        className="grid grid-cols-7 gap-y-[2px] w-full"
        style={{ animation: "emet-month-in .24s cubic-bezier(.22,.61,.36,1) both" }}
      >
        {DOW.map((d) => (
          <div
            key={d}
            className="flex items-center justify-center text-[12px] font-medium uppercase tracking-[.08em] text-[var(--text-3)]"
            style={{ height: DAY_CELL }}
          >
            {d}
          </div>
        ))}
        {grid.map((cell) => renderDay(cell))}
      </div>
    </div>
  );
}
