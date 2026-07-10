"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { IconCheck, IconMoon, IconSun } from "./icons";

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
export function Avatar({ name, color, size = 34 }: { name: string; color?: string | null; size?: number }) {
  const initials = name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <div className="rounded-full flex items-center justify-center font-semibold text-white shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.37, background: color ?? "#8E8E93" }}>
      {initials}
    </div>
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
