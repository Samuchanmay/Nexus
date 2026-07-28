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
export function Switch({ checked, onChange, disabled, label, tone = "neutral", size = "md" }: {
  checked: boolean; onChange: () => void; disabled?: boolean; label?: string; tone?: "neutral" | "status"; size?: "sm" | "md";
}) {
  const offColor = tone === "status" ? "var(--danger)" : "var(--surface-3)";
  // size="sm" — variante ligera para listas densas (p.ej. roster de Equipo,
  // 20+ filas en pantalla): pista y perilla más chicas para que el control
  // no compita visualmente con el resto de la fila.
  const track = size === "sm" ? "w-7 h-4" : "w-9 h-5";
  const thumb = size === "sm" ? "w-3 h-3" : "w-4 h-4";
  const thumbOn = size === "sm" ? "14px" : "18px";
  return (
    <button
      type="button" role="switch" aria-checked={checked} disabled={disabled}
      onClick={onChange}
      className="inline-flex items-center gap-2 disabled:opacity-50"
    >
      <span className={`relative inline-block ${track} rounded-full shrink-0 transition-colors`}
        style={{ background: checked ? "var(--ok)" : offColor, border: "1px solid var(--border)" }}>
        <span className={`absolute top-[1px] ${thumb} rounded-full bg-white transition-all shadow-sm`}
          style={{ left: checked ? thumbOn : "1px" }} />
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
      <p className="text-[10.5px] font-bold" style={{ color: "var(--text-3)" }}>
        {label}
      </p>
      <p className="text-[24px] font-bold mt-1 tabular-nums leading-none" style={{ color }}>{value}</p>
      {hint && <p className="text-[11.5px] mt-1.5" style={{ color: "var(--text-2)" }}>{hint}</p>}
    </div>
  );
}

/* ── C7 · Fila-persona (avatar + nombre + meta + extras) ──
   Componente único reutilizado por Horarios y Equipo — antes cada pantalla
   tenía su propia fila con hover/estructura ligeramente distinta; se
   consolida aquí para que cualquier mejora (hover, punto de estado, acciones
   al pasar el mouse) se propague a toda la app en vez de vivir duplicada.
   El hover usa clases CSS (no mutar el DOM a mano en onMouseEnter/onMouseLeave)
   — mutar style.background imperativamente podía quedar desincronizado del
   estado real de React entre renders y es una fuente típica de comportamiento
   errático en tarjetas con re-render frecuente. */
export function PersonRow({
  name, color, avatarUrl, birthday, meta, right, onClick, active,
  status, statusLabel, badges, hoverActions, dense, size = 34, dim,
}: {
  name: string; color?: string | null; avatarUrl?: string | null; birthday?: boolean; meta?: React.ReactNode;
  right?: React.ReactNode; onClick?: () => void; active?: boolean;
  /** Punto de color junto al avatar (independiente del switch) + su tooltip. */
  status?: string | null; statusLabel?: string;
  /** Fila de badges/pills debajo del nombre (cargo, departamento, etc). */
  badges?: React.ReactNode;
  /** Acciones que solo se revelan al pasar el mouse (nunca permanentes). */
  hoverActions?: React.ReactNode;
  /** Menor padding vertical — para listas largas y densas como Equipo. */
  dense?: boolean;
  size?: number;
  /** Atenúa toda la fila (ej. cuenta desactivada) sin usar otro componente. */
  dim?: boolean;
}) {
  return (
    <div
      className={`group flex items-center gap-3 ${dense ? "px-3.5 py-2" : "px-3.5 py-3"} rounded-sm transition-colors duration-200 ${onClick ? "cursor-pointer hover:bg-hover" : ""}`}
      style={{ ...(active ? { background: "var(--accent-tint)" } : {}), ...(dim ? { opacity: 0.6 } : {}) }}
      onClick={onClick}
    >
      <Avatar name={name} color={color} avatarUrl={avatarUrl} birthday={birthday} size={size} status={status} statusLabel={statusLabel} />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold truncate">{name}</p>
        {badges}
        {meta && <div className="text-[12px] truncate" style={{ color: "var(--text-2)" }}>{meta}</div>}
      </div>
      {hoverActions && (
        // pointer-events-none mientras está invisible: nunca debe quedar un
        // contenedor "fantasma" clickeable encima de la fila cuando el mouse
        // ya no está encima (ver nota de causa raíz en components/ui.tsx Menu).
        <div className="hidden sm:flex items-center gap-0.5 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity" onClick={(e) => e.stopPropagation()}>
          {hoverActions}
        </div>
      )}
      {right}
    </div>
  );
}

/* ── EmptyState ── con CTA opcional: un estado vacío sin acción es un
   callejón sin salida; si hay una acción obvia (crear/añadir/registrar),
   se ofrece aquí mismo en vez de obligar a buscarla en otro lado. */
export function EmptyState({ icon, title, hint, action }: {
  icon?: React.ReactNode; title: string; hint?: string; action?: React.ReactNode;
}) {
  return (
    <div className="card px-6 py-12 text-center">
      {icon && <div className="mx-auto mb-3 w-10 h-10 flex items-center justify-center" style={{ color: "var(--text-3)" }}>{icon}</div>}
      <p className="text-[14.5px] font-semibold" style={{ color: "var(--text-2)" }}>{title}</p>
      {hint && <p className="text-[12.5px] mt-1 max-w-[320px] mx-auto" style={{ color: "var(--text-3)" }}>{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
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
        toast(msgs?.err ?? error.message ?? "Ocurrió un error", "danger");
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
