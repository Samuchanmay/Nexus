"use client";
// ═══════════════════════════════════════════════════════════════
//  C3–C7 · Componentes compartidos extraídos de la duplicación
//  detectada en la auditoría (AUDIT §4–5):
//  PageHeader · StatCard · PersonRow · EmptyState · Field
//  + hook useSupabaseMutation (saving + toast + router.refresh —
//    sustituye los location.reload() dispersos, C5)
// ═══════════════════════════════════════════════════════════════
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, useToast } from "./ui";

/* ── C3 · Cabecera de página (antes repetida 12 veces) ── */
/**
 * iOS-style switch — sustituye <input type="checkbox"> y los pills de texto
 * "Activo/Inactivo" en toda la app.
 * tone="neutral" (default): gris cuando está apagado — para ajustes binarios normales.
 * tone="status": rojo cuando está apagado — para activar/desactivar cuentas, estados, tipos, etc.
 */
export function Switch({ checked, onChange, disabled, label, tone = "neutral" }: {
  checked: boolean; onChange: () => void; disabled?: boolean; label?: string; tone?: "neutral" | "status";
}) {
  const offColor = tone === "status" ? "var(--danger)" : "var(--surface-3)";
  return (
    <button
      type="button" role="switch" aria-checked={checked} disabled={disabled}
      onClick={onChange}
      className="inline-flex items-center gap-2 disabled:opacity-50"
    >
      <span className="relative inline-block w-9 h-5 rounded-full shrink-0 transition-colors"
        style={{ background: checked ? "var(--ok)" : offColor, border: "1px solid var(--border)" }}>
        <span className="absolute top-[1px] w-4 h-4 rounded-full bg-white transition-all shadow-sm"
          style={{ left: checked ? "18px" : "1px" }} />
      </span>
      {label && <span className="text-[12.5px] font-semibold" style={{ color: tone === "status" ? (checked ? "var(--ok)" : "var(--danger)") : "var(--text-1)" }}>{label}</span>}
    </button>
  );
}

export function PageHeader({ title, subtitle, children }: {
  title: string; subtitle?: string; children?: React.ReactNode;
}) {
  return (
    <header className="pt-8 pb-6 flex items-end justify-between gap-4 flex-wrap">
      <div>
        <h1 className="text-[28px] font-bold tracking-tight">{title}</h1>
        {subtitle && (
          <p className="text-[13.5px] mt-1" style={{ color: "var(--text-2)" }}>{subtitle}</p>
        )}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </header>
  );
}

/* ── StatCard · KPI (estilo v6) ── */
export function StatCard({ label, value, hint, tone = "default", onClick }: {
  label: string; value: React.ReactNode; hint?: string;
  tone?: "default" | "ok" | "warn" | "danger" | "accent" | "purple";
  onClick?: () => void;
}) {
  const color = tone === "default" ? "var(--text-1)" : `var(--${tone === "accent" ? "accent" : tone})`;
  return (
    <div className={`card px-4 py-3.5 ${onClick ? "card-hover cursor-pointer" : ""}`} onClick={onClick}>
      <p className="text-[10.5px] font-bold uppercase tracking-[.07em]" style={{ color: "var(--text-3)" }}>
        {label}
      </p>
      <p className="text-[24px] font-bold mt-1 tabular-nums leading-none" style={{ color }}>{value}</p>
      {hint && <p className="text-[11.5px] mt-1.5" style={{ color: "var(--text-2)" }}>{hint}</p>}
    </div>
  );
}

/* ── C7 · Fila-empleado (avatar + nombre + meta + extras) ── */
export function PersonRow({ name, color, meta, right, onClick, active }: {
  name: string; color?: string | null; meta?: React.ReactNode;
  right?: React.ReactNode; onClick?: () => void; active?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 px-3.5 py-3 rounded-sm transition-colors ${onClick ? "cursor-pointer" : ""}`}
      style={active ? { background: "var(--accent-tint)" } : undefined}
      onClick={onClick}
      onMouseEnter={onClick ? (e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "var(--surface-2)"; } : undefined}
      onMouseLeave={onClick ? (e) => { if (!active) (e.currentTarget as HTMLElement).style.background = ""; } : undefined}
    >
      <Avatar name={name} color={color} size={34} />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold truncate">{name}</p>
        {meta && <div className="text-[12px] truncate" style={{ color: "var(--text-2)" }}>{meta}</div>}
      </div>
      {right}
    </div>
  );
}

/* ── EmptyState ── */
export function EmptyState({ icon, title, hint }: {
  icon?: React.ReactNode; title: string; hint?: string;
}) {
  return (
    <div className="card px-6 py-12 text-center">
      {icon && <div className="mx-auto mb-3 w-10 h-10 flex items-center justify-center" style={{ color: "var(--text-3)" }}>{icon}</div>}
      <p className="text-[14.5px] font-semibold" style={{ color: "var(--text-2)" }}>{title}</p>
      {hint && <p className="text-[12.5px] mt-1" style={{ color: "var(--text-3)" }}>{hint}</p>}
    </div>
  );
}

/* ── C4 · Campo de formulario (label + input) ── */
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[12px] font-semibold mb-1.5" style={{ color: "var(--text-2)" }}>{label}</span>
      {children}
    </label>
  );
}

/* ── C5 · useSupabaseMutation — saving + toast + refresh sin recargar ──
   run(fn, { ok, err }): ejecuta la mutación; si fn devuelve un error
   (patrón supabase { error }), muestra err y NO refresca. */
export function useSupabaseMutation() {
  const toast = useToast();
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const run = useCallback(async (
    fn: () => PromiseLike<{ error: { message: string } | null } | void>,
    msgs?: { ok?: string; err?: string },
  ): Promise<boolean> => {
    setSaving(true);
    try {
      const res = await fn();
      const error = res && "error" in res ? res.error : null;
      if (error) {
        toast(msgs?.err ?? error.message ?? "Ocurrió un error");
        return false;
      }
      if (msgs?.ok) toast(msgs.ok);
      router.refresh(); // C5: datos frescos del server sin recarga completa
      return true;
    } finally {
      setSaving(false);
    }
  }, [toast, router]);

  return { run, saving, refresh: router.refresh };
}
