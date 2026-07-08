import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { Icon } from "./icons";

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
  const pad = size === "sm" ? "h-8 px-3 text-[13px] gap-1.5" : "h-10 px-4 text-[14px] gap-2";
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center rounded-s font-semibold whitespace-nowrap",
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
      aria-label={label} title={label}
      className={cx(
        "inline-grid place-items-center h-9 w-9 rounded-s text-text-2",
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
      <h2 className="text-[13px] font-bold tracking-wide uppercase text-text-3">{children}</h2>
      {hint && <span className="text-[12px] text-text-3">{hint}</span>}
    </div>
  );
}

/* ───────────────────────── Input ───────────────────────── */
export function Field({ label, hint, children }: { label?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      {label && <span className="block mb-1.5 text-[13px] font-semibold text-text-2">{label}</span>}
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
          "w-full h-10 rounded-s bg-input border border-border text-[14px] text-text-1",
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
export function Badge({ tone = "neutral", dot, children }: { tone?: Tone; dot?: boolean; children: ReactNode }) {
  const t = TONE[tone];
  return (
    <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[12px] font-semibold"
      style={{ background: t.bg, color: t.fg }}>
      {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.fg }} />}
      {children}
    </span>
  );
}
export function Pill({ active, children, ...rest }: { active?: boolean; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cx(
        "h-8 px-3.5 rounded-full text-[13px] font-semibold transition-colors duration-150",
        active ? "bg-accent text-white" : "bg-surface-2 text-text-2 border border-border hover:bg-hover"
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ───────────────────────── Avatar ───────────────────────── */
export function Avatar({ name, color, size = 34 }: { name: string; color?: string; size?: number }) {
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <span
      className="inline-grid place-items-center rounded-full font-bold text-white shrink-0 select-none"
      style={{ width: size, height: size, background: color ?? "var(--accent)", fontSize: size * 0.38 }}
      title={name}
    >
      {initials}
    </span>
  );
}

/* ───────────────────────── Kbd ───────────────────────── */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-grid place-items-center min-w-[20px] h-[20px] px-1.5 rounded-[6px] bg-surface-2 border border-border text-[11px] font-semibold text-text-3">
      {children}
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
      {hint && <p className="mt-1 text-[13px] text-text-3 max-w-[300px]">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ───────────────────────── StatCard ───────────────────────── */
export function StatCard({ label, value, icon, tone = "accent", delta }: {
  label: string; value: string; icon: string; tone?: Tone; delta?: string;
}) {
  const t = TONE[tone];
  return (
    <Card pad={false} className="p-4">
      <div className="flex items-center justify-between">
        <span className="grid place-items-center h-9 w-9 rounded-s" style={{ background: t.bg, color: t.fg }}>
          <Icon name={icon} size={18} />
        </span>
        {delta && <span className="text-[12px] font-semibold" style={{ color: "var(--ok)" }}>{delta}</span>}
      </div>
      <p className="mt-3 text-[26px] font-bold leading-none text-text-1">{value}</p>
      <p className="mt-1 text-[13px] text-text-3">{label}</p>
    </Card>
  );
}
