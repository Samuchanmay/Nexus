"use client";
import { useEffect, useRef, useState } from "react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./icons";
import { useMountOnOpen } from "@/lib/use-mount-on-open";

/* ── Avatar: una sola implementación en toda la app (W3 — consolidación
   de componentes). Vivía duplicado en components/ui.tsx y aquí con
   diferencias mínimas mainly cosmeticas (color de anillo default, orden
   de cómputo de iniciales) — un bug en una versión no se replicaba a la
   otra. Ahora components/ui.tsx es la fuente única y este archivo solo
   re-exporta, para no romper los ~35 imports existentes de cada lado. */
export { Avatar } from "../ui";

export function cx(...a: (string | false | null | undefined)[]) {
  return a.filter(Boolean).join(" ");
}

/* ───────────────────────── Button ───────────────────────── */
type BtnVariant = "primary" | "subtle" | "ghost" | "danger";
type BtnSize = "sm" | "md";
const BTN: Record<BtnVariant, string> = {
  primary: "bg-accent text-white hover:brightness-110 shadow-sm",
  subtle: "bg-surface-2 text-text-1 border border-border hover:bg-hover",
  ghost: "text-text-2 hover:bg-hover hover:text-text-1",
  danger: "text-white hover:brightness-110",
};
export function Button({
  variant = "subtle", size = "md", icon, iconRight, children, className, ...rest
}: {
  variant?: BtnVariant; size?: BtnSize; icon?: string; iconRight?: string; children?: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const pad = size === "sm" ? "h-8 px-3 text-[13.5px] gap-1.5" : "h-10 px-4 text-[14px] gap-2";
  return (
    <button
      data-ripple
      className={cx(
        "inline-flex items-center justify-center rounded-sm font-semibold whitespace-nowrap",
        "transition-all duration-150 ease-apple active:scale-[.97]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
        "disabled:opacity-45 disabled:pointer-events-none",
        pad, BTN[variant], className
      )}
      style={variant === "danger" ? { background: "var(--danger)" } : undefined}
      {...rest}
    >
      {icon && <Icon name={icon} size={size === "sm" ? 15 : 17} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === "sm" ? 15 : 17} />}
    </button>
  );
}

export function IconButton({ icon, label, className, size = 18, ...rest }: {
  icon: string; label: string; size?: number;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      data-ripple
      aria-label={label} title={label}
      className={cx(
        "inline-grid place-items-center h-9 w-9 rounded-sm text-text-2",
        "hover:bg-hover hover:text-text-1 transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
        className
      )}
      {...rest}
    >
      <Icon name={icon} size={size} />
    </button>
  );
}

/* ───────────────────────── Card ───────────────────────── */
export function Card({ children, className, pad = true, hover = false }: {
  children: ReactNode; className?: string; pad?: boolean; hover?: boolean;
}) {
  return (
    <div className={cx(
      "rounded-m bg-card border border-border",
      pad && "p-5", hover && "transition-all duration-200 hover:border-[var(--text-3)] hover:shadow-nx",
      className
    )}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between mb-3">
      <h2 className="text-[13.5px] font-bold text-text-3">{children}</h2>
      {hint && <span className="text-[12px] text-text-3">{hint}</span>}
    </div>
  );
}

/* ───────────────────────── Skeleton ─────────────────────────
   Shimmer placeholder para reemplazar spinners/"Cargando…". Usar
   Skel para una barra suelta, o los helpers de abajo para formas
   comunes (fila de lista, card de stat, tabla). */
export function Skel({ className }: { className?: string }) {
  return <div className={cx("nx-skel rounded-[4px]", className)} />;
}

export function SkelRow({ avatar = false }: { avatar?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 p-2 md:p-2.5">
      {avatar && <Skel className="h-7 w-7 rounded-full shrink-0" />}
      <div className="flex-1 min-w-0 space-y-1.5">
        <Skel className="h-3 w-[60%]" />
        <Skel className="h-2.5 w-[35%]" />
      </div>
    </div>
  );
}

export function SkelStatCard() {
  return (
    <div className="rounded-m bg-card border border-border p-4 space-y-2.5">
      <Skel className="h-7 w-7 rounded-sm" />
      <Skel className="h-5 w-12" />
      <Skel className="h-2.5 w-16" />
    </div>
  );
}

export function SkelList({ rows = 4, avatar = false }: { rows?: number; avatar?: boolean }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: rows }).map((_, i) => <SkelRow key={i} avatar={avatar} />)}
    </div>
  );
}

/* ───────────────────────── Input ───────────────────────── */
export function Field({ label, hint, children }: { label?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      {label && <span className="block mb-1.5 text-[13.5px] font-semibold text-text-2">{label}</span>}
      {children}
      {hint && <span className="block mt-1 text-[12px] text-text-3">{hint}</span>}
    </label>
  );
}
export function Input({ className, icon, ...rest }: { icon?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3 pointer-events-none"><Icon name={icon} size={16} /></span>}
      <input
        className={cx(
          "w-full h-10 rounded-sm bg-input border border-border text-[14px] text-text-1",
          "placeholder:text-text-3 transition-colors duration-150",
          "focus:outline-none focus:border-accent focus:ring-2 focus:ring-[var(--ring)]",
          icon ? "pl-9 pr-3" : "px-3", className
        )}
        {...rest}
      />
    </div>
  );
}

/* ───────────────────────── Badge / Pill ───────────────────────── */
type Tone = "accent" | "ok" | "warn" | "danger" | "purple" | "neutral";
const TONE: Record<Tone, { bg: string; fg: string }> = {
  accent: { bg: "var(--accent-tint)", fg: "var(--accent)" },
  ok: { bg: "var(--ok-tint)", fg: "var(--ok)" },
  warn: { bg: "var(--warn-tint)", fg: "var(--warn)" },
  danger: { bg: "var(--danger-tint)", fg: "var(--danger)" },
  purple: { bg: "var(--purple-tint)", fg: "var(--purple)" },
  neutral: { bg: "var(--surface-3)", fg: "var(--text-2)" },
};
export function Badge({ tone = "neutral", dot, pulse, children }: { tone?: Tone; dot?: boolean; pulse?: boolean; children: ReactNode }) {
  const t = TONE[tone];
  return (
    <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[12px] font-semibold"
      style={{ background: t.bg, color: t.fg }}>
      {dot && (
        pulse ? (
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: t.fg }} />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: t.fg }} />
          </span>
        ) : (
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.fg }} />
        )
      )}
      {children}
    </span>
  );
}
/* Renombrado de Pill → SegmentPill (W3): el nombre "Pill" ya lo usa
   components/ui.tsx para la píldora de estado (tone-based, no interactiva).
   Eran dos componentes distintos con el mismo nombre — nunca colisionaron
   en tiempo de ejecución porque cada pantalla importaba el correcto, pero
   sí en legibilidad. Este es el botón de filtro/segmento (activo/inactivo,
   con onClick). */
export function SegmentPill({ active, children, ...rest }: { active?: boolean; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cx(
        "h-8 px-3.5 rounded-full text-[13.5px] font-semibold transition-colors duration-150",
        active ? "bg-accent text-white" : "bg-surface-2 text-text-2 border border-border hover:bg-hover"
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ───────────────────────── Kbd ───────────────────────── */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="flex items-center justify-center leading-none min-w-[20px] h-[20px] px-1.5 rounded-[6px] bg-surface-2 border border-border text-[12px] font-semibold text-text-3 not-italic">
      <span className="relative -top-px">{children}</span>
    </kbd>
  );
}

/* ───────────────────────── EmptyState ───────────────────────── */
export function EmptyState({ icon = "sparkle", title, hint, action }: {
  icon?: string; title: string; hint?: string; action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center py-12 px-6">
      <div className="grid place-items-center h-14 w-14 rounded-full mb-4"
        style={{ background: "var(--accent-tint)", color: "var(--accent)" }}>
        <Icon name={icon} size={24} />
      </div>
      <p className="text-[15px] font-bold text-text-1">{title}</p>
      {hint && <p className="mt-1 text-[13.5px] text-text-3 max-w-[300px]">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ───────────────────────── StatCard ─────────────────────────
   Escritorio: layout original (icono, valor grande, etiqueta) sin cambios.
   Móvil: fila compacta estilo Mercado Pago — icono sólido arriba a la
   izquierda, chip con el número arriba a la derecha, título debajo y un
   botón circular de flecha para reforzar que la tarjeta navega a algo. */
export function StatCard({ label, value, icon, tone = "accent", delta, children }: {
  label: string; value: string; icon: string; tone?: Tone; delta?: string; children?: ReactNode;
}) {
  const t = TONE[tone];
  return (
    <Card pad={false} className="p-3.5 md:p-4">
      {/* Móvil — icono discreto (tinte, no relleno sólido) + título/badge/flecha
          en una sola fila para que se lea como un contador, no como un KPI suelto. */}
      <div className="flex md:hidden flex-col gap-1.5">
        <span className="grid place-items-center h-8 w-8 rounded-xl shrink-0" style={{ background: t.bg, color: t.fg }}>
          <Icon name={icon} size={14} />
        </span>
        <div className="flex items-center gap-1.5">
          <p className="text-[13.5px] font-bold leading-snug text-text-1 flex-1 min-w-0">{label}</p>
          <span className="shrink-0 h-5 min-w-[20px] px-1.5 rounded-full grid place-items-center text-[12px] font-bold"
            style={{ background: t.bg, color: t.fg }}>
            {value}
          </span>
          <Icon name="arrow" size={13} className="shrink-0" style={{ color: t.fg }} />
        </div>
        {children && <div className="text-[12px] text-text-3">{children}</div>}
      </div>

      {/* Escritorio — sin cambios */}
      <div className="hidden md:block">
        <div className="flex items-center justify-between">
          <span className="grid place-items-center h-9 w-9 rounded-sm" style={{ background: t.bg, color: t.fg }}>
            <Icon name={icon} size={18} />
          </span>
          {delta && <span className="text-[12px] font-semibold" style={{ color: "var(--ok)" }}>{delta}</span>}
        </div>
        <p className="mt-3 text-[28px] font-bold leading-none text-text-1">{value}</p>
        <p className="mt-1 text-[13.5px] text-text-3">{label}</p>
        {children && <div className="mt-1.5">{children}</div>}
      </div>
    </Card>
  );
}


/* ───────────────────────── Dialog ─────────────────────────
   Diálogo de confirmación accesible y reutilizable (auditoría de diseño,
   punto 7). Reemplaza los modales de confirmación improvisados que había
   por pantalla (empleados, etc.): role="alertdialog", aria-modal,
   aria-labelledby/describedby, foco atrapado dentro del diálogo, cierre
   con Escape, y portado a document.body con el mismo estándar anti-overlay
   -bug que Sheet/Menu/DateSheet (ver DIAGNOSTICO-OVERLAY-BUG.md). */
export function Dialog({
  open, onClose, onConfirm, title, description,
  confirmLabel = "Confirmar", cancelLabel = "Cancelar",
  variant = "default", busy = false, children,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "danger" | "warning";
  busy?: boolean;
  children?: ReactNode;
}) {
  const { mounted, visible } = useMountOnOpen(open, 260);
  const [hydrated, setHydrated] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { setHydrated(true); }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Foco al abrir (en el botón "Cancelar" — nunca en la acción destructiva
  // por defecto) + trampa de Tab dentro del panel + cierre con Escape.
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => cancelRef.current?.focus());
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) { onClose(); return; }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("keydown", onKeyDown); };
  }, [open, onClose, busy]);

  if (!hydrated || !mounted) return null;

  const confirmBg = variant === "danger" ? "var(--danger)" : variant === "warning" ? "var(--warn)" : "var(--accent)";

  return createPortal(
    <div
      className="fixed inset-0 z-[600] flex items-center justify-center px-4"
      style={{
        // Scrim Signal (spec chat §1): oscurece + blur + baja saturación/
        // contraste del fondo; el contenido detrás nunca compite visualmente.
        background: visible ? "rgba(0,0,0,.42)" : "rgba(0,0,0,0)",
        backdropFilter: visible ? "blur(18px) saturate(.75) brightness(.72)" : "blur(0px) saturate(1) brightness(1)",
        WebkitBackdropFilter: visible ? "blur(18px) saturate(.75) brightness(.72)" : "blur(0px) saturate(1) brightness(1)",
        pointerEvents: visible ? "all" : "none",
        transition: "background .28s var(--ease), backdrop-filter .28s var(--ease)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="nx-dialog-title"
      aria-describedby={description ? "nx-dialog-desc" : undefined}
    >
      <div
        ref={panelRef}
        className="w-full max-w-[380px] p-5"
        style={{
          background: "var(--surface)", borderRadius: 20, border: "0.5px solid var(--border-2)",
          boxShadow: "0 8px 60px rgba(0,0,0,0.22)",
          transform: visible ? "scale(1)" : "scale(.96)",
          opacity: visible ? 1 : 0,
          transition: "transform .28s var(--spring), opacity .2s ease",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <p id="nx-dialog-title" className="text-[15px] font-bold">{title}</p>
        {description && (
          <p id="nx-dialog-desc" className="text-[12.5px] mt-1.5" style={{ color: "var(--text-2)" }}>
            {description}
          </p>
        )}
        {children}
        <div className="flex gap-2.5 mt-4">
          <button
            ref={cancelRef}
            type="button"
            className="btn-secondary flex-1 py-2.5 text-[13.5px]"
            disabled={busy}
            aria-label={cancelLabel}
            onClick={onClose}
          >
            {cancelLabel}
          </button>
          {onConfirm && (
            <button
              type="button"
              className="flex-1 py-2.5 text-[13.5px] rounded-full font-semibold text-white disabled:opacity-60"
              style={{ background: confirmBg }}
              disabled={busy}
              aria-label={confirmLabel}
              onClick={onConfirm}
            >
              {busy ? "…" : confirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
