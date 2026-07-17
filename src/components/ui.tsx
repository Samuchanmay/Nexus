"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { IconCheck, IconMoon, IconSun } from "./icons";
import { MONTHS, DOW, buildMonthGrid, monthBounds, shiftMonth } from "@/lib/calendar-grid";

/* ── Toast ── */
const ToastCtx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState("");
  const [show, setShow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const toast = useCallback((m: string) => {
    setMsg(m); setShow(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setShow(false), 3400);
  }, []);
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div
        className="fixed left-1/2 z-[9999] flex items-center gap-2 rounded-full px-5 py-3 text-[13px] font-semibold whitespace-nowrap"
        style={{
          top: "max(18px, env(safe-area-inset-top))",
          background: "color-mix(in srgb, var(--text-1) 92%, transparent)",
          color: "var(--bg)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.10)",
          transform: show ? "translateX(-50%) translateY(0)" : "translateX(-50%) translateY(-90px)",
          transition: "transform .45s var(--spring)",
        }}
        role="status"
      >
        <IconCheck className="w-3.5 h-3.5" />{msg}
      </div>
    </ToastCtx.Provider>
  );
}

/* ── Theme toggle ── */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.getAttribute("data-theme") === "dark");
  }, []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
    try { localStorage.setItem("nexus-theme", next ? "dark" : "light"); } catch {}
  };
  return (
    <button onClick={toggle} aria-label="Cambiar tema"
      className="w-[34px] h-[34px] rounded-full flex items-center justify-center"
      style={{ background: "var(--surface-2)", border: "0.5px solid var(--border)", color: "var(--text-2)" }}>
      {dark ? <IconSun /> : <IconMoon />}
    </button>
  );
}

/* ── Selector deslizable (pastilla con spring real) ── */
export function SlidingSegments({ options, value, onChange }: {
  options: string[]; value: string; onChange: (v: string) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const move = useCallback(() => {
    const wrap = wrapRef.current, thumb = thumbRef.current;
    if (!wrap || !thumb) return;
    const btn = wrap.querySelector<HTMLButtonElement>(`[data-val="${value}"]`);
    if (!btn) return;
    const w = wrap.getBoundingClientRect(), b = btn.getBoundingClientRect();
    thumb.style.width = b.width + "px";
    thumb.style.transform = `translateX(${b.left - w.left - 3}px)`;
  }, [value]);
  useEffect(() => {
    move();
    window.addEventListener("resize", move);
    return () => window.removeEventListener("resize", move);
  }, [move]);
  return (
    <div className="seg" ref={wrapRef}>
      <div className="seg-thumb" ref={thumbRef} />
      {options.map((o) => (
        <button key={o} data-val={o} onClick={() => onChange(o)}
          className="relative z-[1] px-3.5 py-1.5 rounded-full text-[12.5px] font-semibold transition-colors"
          style={{ color: value === o ? "var(--text-1)" : "var(--text-2)" }}>
          {o}
        </button>
      ))}
    </div>
  );
}

/* ── Avatar con color por empleado ── */
export function Avatar({ name, color, size = 34, avatarUrl }: { name: string; color?: string | null; size?: number; avatarUrl?: string | null }) {
  const initials = name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const ring = { boxShadow: `0 0 0 2px var(--bg), 0 0 0 3.5px ${color ?? "#8E8E93"}` };
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={avatarUrl} alt={name} title={name}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size, ...ring }} />
    );
  }
  return (
    <div className="rounded-full flex items-center justify-center font-semibold text-white shrink-0"
      style={{
        width: size, height: size, fontSize: size * 0.37, background: color ?? "#8E8E93",
        ...ring,
      }}>
      {initials}
    </div>
  );
}

/** Campo de fecha con máscara dd/mm/aaaa — reemplaza <input type="date"> cuando
 * necesitamos garantizar el formato visual sin importar el locale del navegador
 * (el nativo respeta el idioma/región del sistema operativo del usuario, no el
 * de la app, y por eso a veces se ve aaaa/mm/dd aunque el resto de Nexus use
 * dd/mm/aaaa). El valor que entra/sale sigue siendo ISO (aaaa-mm-dd). */
export function DateField({ value, onChange, className, placeholder = "dd/mm/aaaa" }: {
  value: string; onChange: (iso: string) => void; className?: string; placeholder?: string;
}) {
  const isoToDmy = (iso: string) => {
    const [y, m, d] = iso.split("-");
    return y && m && d ? `${d}/${m}/${y}` : "";
  };
  const [text, setText] = useState(value ? isoToDmy(value) : "");
  useEffect(() => { setText(value ? isoToDmy(value) : ""); }, [value]);

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

/* ── SelectField: select nativo con chevron propio (look Apple, sin la flecha fea del navegador) ── */
export function SelectField({ value, onChange, children, label, className }: {
  value: string; onChange: (v: string) => void; children: React.ReactNode; label?: string; className?: string;
}) {
  return (
    <div className={className}>
      {label && <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>{label}</label>}
      <div className="relative">
        <select
          className="field-input appearance-none pr-9 cursor-pointer w-full"
          value={value} onChange={(e) => onChange(e.target.value)}
        >
          {children}
        </select>
        <svg viewBox="0 0 20 20" fill="none" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
          style={{ color: "var(--text-3)" }}>
          <path d="M5 7.5l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

/* ── Checkbox: cuadro propio (look Apple, sin el checkbox nativo del navegador) ── */
export function CheckBox({ checked }: { checked: boolean }) {
  return (
    <span
      className="inline-grid place-items-center rounded-[6px] shrink-0 transition-colors"
      style={{
        width: 20, height: 20,
        background: checked ? "var(--accent)" : "var(--surface-2)",
        border: checked ? "1px solid var(--accent)" : "1px solid var(--border-2)",
      }}
    >
      {checked && (
        <svg viewBox="0 0 20 20" fill="none" className="w-3 h-3">
          <path d="M4 10l4 4 8-9" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
}

/* ── Sheet (modal deslizable desde abajo) ── */
export function Sheet({ open, onClose, title, subtitle, children }: {
  open: boolean; onClose: () => void; title: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[500] flex items-end justify-center"
      style={{
        background: open ? "rgba(0,0,0,.38)" : "rgba(0,0,0,0)",
        backdropFilter: open ? "blur(14px)" : "blur(0px)",
        pointerEvents: open ? "all" : "none",
        transition: "background .35s var(--ease), backdrop-filter .35s var(--ease)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-[680px] max-h-[88vh] overflow-y-auto pb-11"
        style={{
          background: "var(--surface)",
          borderRadius: "26px 26px 0 0",
          borderTop: "0.5px solid var(--border-2)",
          boxShadow: "0 -8px 60px rgba(0,0,0,0.18)",
          transform: open ? "translateY(0)" : "translateY(100%)",
          transition: "transform .46s var(--spring)",
        }}>
        <div className="w-[34px] h-[5px] rounded-[3px] mx-auto mt-3" style={{ background: "var(--surface-3)" }} />
        <div className="flex items-center justify-between px-5 pt-4">
          <h2 className="text-[19px] font-bold tracking-tight">{title}</h2>
          {subtitle && <p className="text-[13px] mt-1" style={{ color: "var(--text-2)" }}>{subtitle}</p>}
          <button onClick={onClose} aria-label="Cerrar"
            className="w-7 h-7 rounded-full flex items-center justify-center"
            style={{ background: "var(--surface-2)", color: "var(--text-2)" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" className="w-[13px] h-[13px]">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="px-5 pt-4">{children}</div>
      </div>
    </div>
  );
}

/* ── Status pill ── */
const STATUS_STYLES: Record<string, { bg: string; fg: string }> = {
  ok: { bg: "var(--ok-tint)", fg: "var(--ok)" },
  warn: { bg: "var(--warn-tint)", fg: "var(--warn)" },
  danger: { bg: "var(--danger-tint)", fg: "var(--danger)" },
  accent: { bg: "var(--accent-tint)", fg: "var(--accent)" },
  muted: { bg: "var(--surface-3)", fg: "var(--text-3)" },
};
export function Pill({ tone, children }: { tone: keyof typeof STATUS_STYLES; children: React.ReactNode }) {
  const s = STATUS_STYLES[tone];
  return <span className="pill" style={{ background: s.bg, color: s.fg }}>{children}</span>;
}

/* ── DateRangeCalendar: selector visual de rango de fechas (reemplaza los
   <input type="date"> sueltos). Click 1 = inicio, click 2 = fin. Marca
   fines de semana, festivos y fechas ya tomadas como no seleccionables. ── */
export function DateRangeCalendar({
  start, end, onSelect, holidays, disabledDates, minDate, legend = true,
}: {
  start: string | null;
  end: string | null;
  onSelect: (start: string | null, end: string | null) => void;
  holidays?: Set<string>;
  disabledDates?: Set<string>;
  minDate?: string;
  legend?: boolean;
}) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const [ym, setYm] = useState<string>((start ?? todayIso).slice(0, 7));
  const { first, last, daysInMonth, year, month } = monthBounds(ym);
  const cells = useMemo(() => buildMonthGrid(first, last, daysInMonth), [first, last, daysInMonth]);

  const isWeekend = (date: string) => {
    const dow = new Date(`${date}T12:00:00`).getDay();
    return dow === 0 || dow === 6;
  };
  const isHoliday = (date: string) => holidays?.has(date) ?? false;
  const isTaken = (date: string) => disabledDates?.has(date) ?? false;
  const isPast = (date: string) => (minDate ? date < minDate : false);
  const inRange = (date: string) => !!(start && end && date >= start && date <= end);

  const click = (date: string) => {
    if (isWeekend(date) || isHoliday(date) || isTaken(date) || isPast(date)) return;
    if (!start || (start && end)) { onSelect(date, null); return; }
    if (date < start) { onSelect(date, null); return; }
    onSelect(start, date);
  };

  return (
    <div className="rounded-md overflow-hidden" style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
      <div className="flex items-center justify-between px-3.5 py-2.5" style={{ background: "var(--surface-2)" }}>
        <button type="button" onClick={() => setYm(shiftMonth(ym, -1))}
          className="w-7 h-7 rounded-full flex items-center justify-center text-[15px] font-bold"
          style={{ color: "var(--text-2)" }} aria-label="Mes anterior">‹</button>
        <p className="text-[13px] font-bold capitalize">{MONTHS[month - 1]} {year}</p>
        <button type="button" onClick={() => setYm(shiftMonth(ym, 1))}
          className="w-7 h-7 rounded-full flex items-center justify-center text-[15px] font-bold"
          style={{ color: "var(--text-2)" }} aria-label="Mes siguiente">›</button>
      </div>
      <div className="grid grid-cols-7 px-2.5 pt-2.5 text-center">
        {DOW.map((d) => (
          <span key={d} className="text-[10px] font-semibold py-1" style={{ color: "var(--text-3)" }}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-[3px] px-2.5 pb-3">
        {cells.map((c) => {
          const weekend = isWeekend(c.date), holiday = isHoliday(c.date), taken = isTaken(c.date), past = isPast(c.date);
          const blocked = weekend || holiday || taken || past;
          const isStart = c.date === start, isEnd = c.date === end, ranged = inRange(c.date);
          const selected = isStart || isEnd;
          return (
            <button
              key={c.date} type="button" disabled={!c.inMonth || blocked}
              onClick={() => click(c.date)}
              className="aspect-square rounded-sm text-[12px] font-semibold flex items-center justify-center transition-colors"
              style={{
                opacity: c.inMonth ? 1 : 0.22,
                background: selected ? "var(--accent)" : ranged ? "var(--accent-tint)"
                  : holiday ? "var(--danger-tint)" : taken ? "var(--warn-tint)" : "transparent",
                color: selected ? "#fff" : blocked && c.inMonth ? "var(--text-3)" : "var(--text-1)",
                cursor: !c.inMonth || blocked ? "default" : "pointer",
                textDecoration: (weekend || holiday || taken) && c.inMonth && !selected ? "line-through" : "none",
              }}>
              {c.day}
            </button>
          );
        })}
      </div>
      {legend && (
        <div className="flex flex-wrap items-center gap-3 px-3.5 pb-3 text-[10.5px]" style={{ color: "var(--text-3)" }}>
          <span className="flex items-center gap-1.5">
            <i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "var(--accent)" }} /> Seleccionado
          </span>
          <span className="flex items-center gap-1.5">
            <i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "var(--accent-tint)" }} /> Rango
          </span>
          <span className="flex items-center gap-1.5">
            <i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "var(--danger-tint)" }} /> Festivo
          </span>
          <span className="flex items-center gap-1.5">
            <i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "var(--warn-tint)" }} /> Ya tomado
          </span>
        </div>
      )}
    </div>
  );
}
