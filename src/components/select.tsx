"use client";
/* ═══════════════════════════════════════════════════════════════
   Select / TimePicker — el ÚNICO selector premium de Emet.
   Reemplaza <select> nativo y <input type="time"> en toda la app:
   mismo Popover centrado (CenteredOverlay), mismo buscador arriba,
   mismas filas (avatar/ícono + título + subtítulo), mismo check de
   seleccionado. Ningún módulo tiene su propio "select" distinto.
═══════════════════════════════════════════════════════════════ */
import { useEffect, useMemo, useRef, useState } from "react";
import { CenteredOverlay } from "./overlay";
import { Avatar } from "./ui";
import { IconSearch, IconChevronDown, IconCheck, IconClock } from "./icons";
import { fmtTime } from "@/lib/hours";

export type SelectOption = {
  value: string;
  label: string;
  sublabel?: string;
  avatar?: { name: string; color?: string | null; avatarUrl?: string | null };
  icon?: React.ReactNode;
  /** Texto extra a considerar en la búsqueda (ej. correo, sinónimos). */
  keywords?: string;
};

export function Select({
  value, onChange, options, placeholder = "Seleccionar…", title = "Seleccionar",
  searchable = true, className, disabled, renderTriggerLabel, emptyLabel = "Sin resultados",
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  title?: string;
  searchable?: boolean;
  className?: string;
  disabled?: boolean;
  /** Si el valor actual no coincide con ninguna opción (ej. hora fuera del
      paso de la lista), formatea el valor crudo en vez de caer al placeholder. */
  renderTriggerLabel?: (v: string) => string;
  emptyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const current = options.find((o) => o.value === value);
  const triggerLabel = current?.label ?? (value && renderTriggerLabel ? renderTriggerLabel(value) : "");

  const filtered = useMemo(() => {
    if (!q.trim()) return options;
    const needle = q.trim().toLowerCase();
    return options.filter((o) => `${o.label} ${o.sublabel ?? ""} ${o.keywords ?? ""}`.toLowerCase().includes(needle));
  }, [options, q]);

  return (
    <>
      <button
        type="button" disabled={disabled}
        onClick={() => { setQ(""); setOpen(true); }}
        className={className ?? "field-input w-full flex items-center justify-between gap-2 text-left"}
      >
        <span className="flex items-center gap-2 min-w-0">
          {current?.avatar && (
            <Avatar name={current.avatar.name} color={current.avatar.color} avatarUrl={current.avatar.avatarUrl} size={22} />
          )}
          {current?.icon}
          <span className="truncate" style={{ color: triggerLabel ? "var(--text-1)" : "var(--text-3)" }}>
            {triggerLabel || placeholder}
          </span>
        </span>
        <IconChevronDown className="w-3.5 h-3.5 shrink-0 text-[var(--text-3)]" />
      </button>

      <CenteredOverlay open={open} onClose={() => setOpen(false)} ariaLabel={title} width={380}>
        <div className="px-4 pt-4 pb-2 shrink-0">
          <p className="text-[length:var(--fs-lg)] font-bold mb-3">{title}</p>
          {searchable && (
            <div className="relative">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-3)]" />
              {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
              <input
                autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…"
                className="field-input pl-9 w-full"
              />
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto nx-scroll px-2 pb-3">
          {filtered.length === 0 ? (
            <p className="text-[13px] text-center py-8" style={{ color: "var(--text-3)" }}>{emptyLabel}</p>
          ) : (
            filtered.map((o) => (
              <button
                key={o.value} type="button"
                onClick={() => { onChange(o.value); setOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-sm text-left transition-colors hover:bg-hover"
              >
                {o.avatar && <Avatar name={o.avatar.name} color={o.avatar.color} avatarUrl={o.avatar.avatarUrl} size={30} />}
                {o.icon && (
                  <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: "var(--accent-tint)", color: "var(--accent)" }}>
                    {o.icon}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-[length:var(--fs-base)] font-semibold truncate">{o.label}</span>
                  {o.sublabel && <span className="block text-[12px] truncate" style={{ color: "var(--text-2)" }}>{o.sublabel}</span>}
                </span>
                {o.value === value && <IconCheck className="w-4 h-4 shrink-0 text-[var(--accent)]" />}
              </button>
            ))
          )}
        </div>
      </CenteredOverlay>
    </>
  );
}

/* ── TimePicker — reconstruido desde cero, componente oficial de hora de
   Emet. Ya NO es un Select genérico con una lista larga cada 5 min: es su
   propio Popover centrado (mismo shell que DatePicker — CenteredOverlay,
   blur de fondo, animaciones del Design System), con horarios generados
   SOLO cada 10 minutos (nunca minutos arbitrarios como 7:03 o 7:17),
   siempre en formato 12h AM/PM, con búsqueda inteligente y navegación
   completa por teclado (ESC cierra, Enter selecciona, flechas mueven la
   selección, Tab recorre los controles). ── */

type TimeOption = { value: string; label: string; hour12: number; minute: number; meridiem: "AM" | "PM" };

function buildTimeOptions(stepMin: number): TimeOption[] {
  const opts: TimeOption[] = [];
  for (let m = 0; m < 24 * 60; m += stepMin) {
    const hh24 = Math.floor(m / 60);
    const mm = m % 60;
    const hhmm = `${String(hh24).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    const meridiem: "AM" | "PM" = hh24 < 12 ? "AM" : "PM";
    const hour12 = hh24 % 12 === 0 ? 12 : hh24 % 12;
    opts.push({ value: hhmm, label: fmtTime(hhmm), hour12, minute: mm, meridiem });
  }
  return opts;
}

/** Búsqueda inteligente: "8" → 8:00/8:10/8:20… (AM y PM); "8:3" → 8:30…;
    "2 pm"/"2p" → solo las coincidencias de la tarde a esa hora. */
function matchesTimeQuery(opt: TimeOption, raw: string): boolean {
  const q = raw.trim().toLowerCase().replace(/\./g, "");
  if (!q) return true;

  const m = q.match(/^(\d{1,2})(?::(\d{0,2}))?\s*(a|am|p|pm)?$/);
  if (!m) {
    // No coincide con el patrón de hora — cae a texto plano sobre la etiqueta.
    return opt.label.toLowerCase().includes(q);
  }
  const [, hourStr, minStr, meridiemStr] = m;
  const hourNum = parseInt(hourStr, 10);
  if (hourNum < 1 || hourNum > 12) return false;
  if (opt.hour12 !== hourNum) return false;

  if (meridiemStr) {
    const wantsPM = meridiemStr.startsWith("p");
    if (wantsPM && opt.meridiem !== "PM") return false;
    if (!wantsPM && opt.meridiem !== "AM") return false;
  }

  if (minStr) {
    if (!String(opt.minute).padStart(2, "0").startsWith(minStr.padStart(minStr.length, "0") || "0")) {
      // minStr vacío ("8:") no filtra minutos todavía.
      if (minStr.length > 0 && !String(opt.minute).padStart(2, "0").startsWith(minStr)) return false;
    }
  }
  return true;
}

export function TimePicker({
  value, onChange, placeholder = "Seleccionar hora", className, disabled, stepMin = 10, title = "Selecciona una hora",
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string; disabled?: boolean; stepMin?: number; title?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const options = useMemo(() => buildTimeOptions(stepMin), [stepMin]);
  const filtered = useMemo(
    () => (q.trim() ? options.filter((o) => matchesTimeQuery(o, q)) : options),
    [options, q]
  );

  useEffect(() => { setSel(0); }, [q, open]);
  useEffect(() => { if (open) requestAnimationFrame(() => inputRef.current?.focus()); }, [open]);
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${sel}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const picked = filtered[sel];
      if (picked) { onChange(picked.value); setOpen(false); }
    }
    // ESC ya lo maneja CenteredOverlay a nivel global; Tab usa el orden natural del DOM.
  };

  const current = options.find((o) => o.value === value);

  return (
    <>
      <button
        type="button" disabled={disabled}
        onClick={() => { setQ(""); setOpen(true); }}
        className={className ?? "field-input w-full flex items-center justify-between gap-2 text-left"}
      >
        <span className="flex items-center gap-2 min-w-0">
          <IconClock className="w-3.5 h-3.5 shrink-0 text-[var(--text-3)]" />
          <span className="truncate" style={{ color: current ? "var(--text-1)" : "var(--text-3)" }}>
            {current ? fmtTime(current.value) : placeholder}
          </span>
        </span>
        <IconChevronDown className="w-3.5 h-3.5 shrink-0 text-[var(--text-3)]" />
      </button>

      <CenteredOverlay open={open} onClose={() => setOpen(false)} ariaLabel={title} width={320}>
        <div className="px-4 pt-4 pb-2 shrink-0">
          <p className="text-[length:var(--fs-lg)] font-bold mb-3">{title}</p>
          <div className="relative">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-3)]" />
            {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
            <input
              ref={inputRef} autoFocus value={q} onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ej. 8, 2 pm, 8:30…"
              className="field-input pl-9 w-full"
            />
          </div>
        </div>
        <div ref={listRef} className="flex-1 overflow-y-auto nx-scroll px-2 pb-3 grid grid-cols-3 gap-1.5" onKeyDown={onKeyDown} tabIndex={-1}>
          {filtered.length === 0 ? (
            <p className="col-span-3 text-[13px] text-center py-8" style={{ color: "var(--text-3)" }}>Sin horas que coincidan</p>
          ) : (
            filtered.map((o, idx) => {
              const isSelected = o.value === value;
              const isHighlighted = idx === sel;
              return (
                <button
                  key={o.value} type="button" data-idx={idx}
                  onMouseEnter={() => setSel(idx)}
                  onClick={() => { onChange(o.value); setOpen(false); }}
                  className="flex items-center justify-center gap-1 px-2 py-2 rounded-md text-[13px] font-semibold transition-colors"
                  style={{
                    background: isHighlighted ? "var(--hover)" : isSelected ? "var(--accent-tint)" : "transparent",
                    color: isSelected ? "var(--accent)" : "var(--text-1)",
                  }}
                >
                  {o.label}
                  {isSelected && <IconCheck className="w-3 h-3 shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      </CenteredOverlay>
    </>
  );
}
