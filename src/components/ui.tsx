"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { IconCheck, IconMoon, IconSun, IconAlert, IconX } from "./icons";
import { useMountOnOpen } from "@/lib/use-mount-on-open";

/* ── Fechas: un solo componente en toda la app (Date Sheet) ──
   Popover en escritorio, bottom sheet en móvil, portado a document.body
   para nunca quedar detrás de un Card/Sheet/Modal. Ver components/date-sheet.tsx. */
export { DateField, DatePicker, DateRangeField, DateRangeCalendar } from "./date-sheet";

/* ── Toast ──
   Tono-consciente: éxito (default) hace un slide limpio con check;
   error hace un pequeño "shake" con ícono de alerta — para que el
   feedback de una acción clave (guardar/aprobar/rechazar) se sienta
   distinto según si salió bien o mal, no solo el texto. */
type ToastTone = "ok" | "danger" | "warn";
const ToastCtx = createContext<(msg: string, tone?: ToastTone) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

const TOAST_TONE: Record<ToastTone, { bg: string; fg: string; Icon: typeof IconCheck }> = {
  ok: { bg: "color-mix(in srgb, var(--text-1) 92%, transparent)", fg: "var(--bg)", Icon: IconCheck },
  danger: { bg: "var(--danger)", fg: "#fff", Icon: IconX },
  warn: { bg: "var(--warn)", fg: "#fff", Icon: IconAlert },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState("");
  const [tone, setTone] = useState<ToastTone>("ok");
  const [show, setShow] = useState(false);
  const [shake, setShake] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const toast = useCallback((m: string, t: ToastTone = "ok") => {
    setMsg(m); setTone(t); setShow(true);
    if (t !== "ok") { setShake(true); setTimeout(() => setShake(false), 420); }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setShow(false), 3400);
  }, []);
  const { bg, fg, Icon: ToneIcon } = TOAST_TONE[tone];
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div
        className={shake ? "nx-toast-shake" : undefined}
        style={{
          position: "fixed", left: "50%", zIndex: 9999,
          display: "flex", alignItems: "center", gap: 8,
          borderRadius: 999, padding: "12px 20px", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap",
          top: "max(18px, env(safe-area-inset-top))",
          background: bg, color: fg,
          boxShadow: "0 16px 48px rgba(0,0,0,0.10)",
          transform: show ? "translateX(-50%) translateY(0)" : "translateX(-50%) translateY(-90px)",
          transition: "transform .45s var(--spring), background .2s ease",
        }}
        role="status"
      >
        <ToneIcon className="w-3.5 h-3.5" />{msg}
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
    // offsetLeft/offsetWidth (en vez de getBoundingClientRect) porque son enteros
    // de layout ya resueltos por el motor — inmunes al zoom global (html{zoom:1.1})
    // y a redondeos de sub-píxel que antes dejaban la pastilla desfasada del texto.
    thumb.style.width = btn.offsetWidth + "px";
    thumb.style.transform = `translateX(${btn.offsetLeft}px)`;
  }, [value]);
  useEffect(() => {
    // Requiere doble medición: la primera puede correr antes de que la
    // fuente/layout terminen de asentarse (deja el thumb desfasado hasta el
    // siguiente cambio de valor). rAF + ResizeObserver lo mantienen exacto
    // incluso si el ancho del contenedor cambia sin un resize de ventana.
    move();
    const raf = requestAnimationFrame(move);
    window.addEventListener("resize", move);
    const ro = wrapRef.current ? new ResizeObserver(move) : null;
    if (ro && wrapRef.current) ro.observe(wrapRef.current);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", move);
      ro?.disconnect();
    };
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
export function Avatar({ name, color, size = 34, avatarUrl, birthday, status, statusLabel }: {
  name: string; color?: string | null; size?: number; avatarUrl?: string | null; birthday?: boolean;
  /** Color del anillo de estado (trabajando/pausa/fuera). Si se da junto con
      birthday, el cumpleaños gana el espacio de la esquina — es lo más raro
      de los dos y lo que más vale la pena celebrar. */
  status?: string | null; statusLabel?: string;
}) {
  const initials = name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const ring = { boxShadow: `0 0 0 2px var(--bg), 0 0 0 3.5px ${color ?? "#8E8E93"}` };
  const content = avatarUrl ? (
    // El recorte circular vive en este span envolvente (overflow:hidden),
    // no en el <img> — aplicar rounded-full+object-cover directo sobre el
    // <img> puede dejar una esquina sin recortar del todo en algunos
    // navegadores cuando la imagen fuente no es cuadrada (se ve "cortado").
    // El ring (box-shadow) va en el span de afuera para que este mismo
    // overflow:hidden no se lo recorte a él también.
    <span className="relative block rounded-full shrink-0" style={{ width: size, height: size, ...ring }}>
      <span className="block w-full h-full rounded-full overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={avatarUrl} alt={name} title={name} className="w-full h-full object-cover" />
      </span>
    </span>
  ) : (
    <div className="rounded-full flex items-center justify-center font-semibold text-white"
      style={{
        width: size, height: size, fontSize: size * 0.37, background: color ?? "#8E8E93",
        ...ring,
      }}>
      {initials}
    </div>
  );
  if (!birthday && !status) return <span className="inline-block shrink-0" style={{ width: size, height: size }}>{content}</span>;
  const badge = Math.max(13, Math.round(size * 0.4));
  const dot = Math.max(9, Math.round(size * 0.28));
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      {content}
      {birthday ? (
        <span
          className="absolute grid place-items-center rounded-full"
          style={{ right: -2, bottom: -2, width: badge, height: badge, fontSize: badge * 0.62, lineHeight: 1, background: "var(--bg)", boxShadow: "0 0 0 2px var(--bg)" }}
          title="¡Feliz cumpleaños!"
        >
          🎉
        </span>
      ) : status ? (
        <span
          className="absolute rounded-full"
          style={{ right: -1, bottom: -1, width: dot, height: dot, background: status, boxShadow: "0 0 0 2px var(--bg)" }}
          title={statusLabel}
        />
      ) : null}
    </span>
  );
}


/* ── Menu / MenuItem: menú desplegable propio (look Apple, ancla junto al
   botón que lo abre) — reemplaza los menús ad-hoc que se repetían por
   pantalla (Acciones en Proyectos, menú del avatar en el shell). ── */
export function Menu({ trigger, align = "right", width = 210, children }: {
  trigger: (props: { onClick: () => void; open: boolean }) => React.ReactNode;
  align?: "left" | "right";
  width?: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block">
      {trigger({ onClick: () => setOpen((v) => !v), open })}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className={`absolute ${align === "right" ? "right-0" : "left-0"} top-full mt-1.5 z-50 nx-pop`}
            style={{ width }}
            onClick={() => setOpen(false)}
          >
            <div className="rounded-lg overflow-hidden shadow-nx" style={{ background: "var(--panel)", border: "1px solid var(--border)" }}>
              {children}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function MenuItem({ icon, children, onClick, danger, href, download }: {
  icon?: React.ReactNode; children: React.ReactNode; onClick?: () => void; danger?: boolean;
  href?: string; download?: string;
}) {
  const cls = "w-full flex items-center gap-2.5 px-3.5 h-11 text-[13px] font-semibold text-left transition-colors hover:bg-hover";
  const style = { color: danger ? "var(--danger)" : "var(--text-1)" };
  if (href) {
    return <a href={href} download={download} onClick={onClick} className={cls} style={style}>{icon}{children}</a>;
  }
  return <button type="button" onClick={onClick} className={cls} style={style}>{icon}{children}</button>;
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

/* ── Sheet (modal deslizable desde abajo) ──
   Cierre unificado: click fuera, tecla ESC, o arrastrar hacia abajo
   desde el handle/encabezado. Sin botón "X": el handle superior ya
   comunica que el panel es deslizable. */
export function Sheet({ open, onClose, title, subtitle, children }: {
  open: boolean; onClose: () => void; title: string; subtitle?: string; children: React.ReactNode;
}) {
  const [dragY, setDragY] = useState(0);
  const dragging = useRef(false);
  const startY = useRef(0);
  // Se desmonta por completo ~460ms después de cerrar (dura lo mismo que la
  // transición de salida) — nunca se queda flotando en el DOM alternando
  // solo pointer-events, que era lo que podía dejar la app bloqueada tras
  // cerrar el detalle de un colaborador (mismo estándar que Drawer/Spotlight/
  // Menu/DateSheet, que ya se desmontan al cerrar).
  const { mounted, visible } = useMountOnOpen(open, 460);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  useEffect(() => { if (!open) setDragY(0); }, [open]);

  const onTouchStart = (e: React.TouchEvent) => {
    dragging.current = true;
    startY.current = e.touches[0].clientY;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragging.current) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0) setDragY(delta);
  };
  const onTouchEnd = () => {
    dragging.current = false;
    if (dragY > 90) onClose();
    setDragY(0);
  };

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-[500] flex items-end justify-center"
      style={{
        background: visible ? "rgba(0,0,0,.38)" : "rgba(0,0,0,0)",
        backdropFilter: visible ? "blur(14px)" : "blur(0px)",
        pointerEvents: visible ? "all" : "none",
        transition: "background .35s var(--ease), backdrop-filter .35s var(--ease)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-[680px] max-h-[88vh] overflow-y-auto pb-11"
        style={{
          background: "var(--surface)",
          borderRadius: "26px 26px 0 0",
          borderTop: "0.5px solid var(--border-2)",
          boxShadow: "0 -8px 60px rgba(0,0,0,0.18)",
          transform: visible ? `translateY(${dragY}px)` : "translateY(100%)",
          transition: dragY ? "none" : "transform .46s var(--spring)",
        }}>
        <div
          className="cursor-grab active:cursor-grabbing"
          onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        >
          <div className="w-[34px] h-[5px] rounded-[3px] mx-auto mt-3" style={{ background: "var(--surface-3)" }} />
          <div className="flex items-center justify-between px-5 pt-4">
            <h2 className="text-[19px] font-bold tracking-tight">{title}</h2>
            {subtitle && <p className="text-[13px] mt-1" style={{ color: "var(--text-2)" }}>{subtitle}</p>}
          </div>
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
  purple: { bg: "var(--purple-tint)", fg: "var(--purple)" },
};
export function Pill({ tone, children }: { tone: keyof typeof STATUS_STYLES; children: React.ReactNode }) {
  const s = STATUS_STYLES[tone];
  return <span className="pill" style={{ background: s.bg, color: s.fg }}>{children}</span>;
}
