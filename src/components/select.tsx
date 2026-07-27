"use client";
/* ═══════════════════════════════════════════════════════════════
   Select / TimePicker — el ÚNICO selector premium de Emet.
   Reemplaza <select> nativo y <input type="time"> en toda la app:
   mismo Popover centrado (CenteredOverlay), mismo buscador arriba,
   mismas filas (avatar/ícono + título + subtítulo), mismo check de
   seleccionado. Ningún módulo tiene su propio "select" distinto.
═══════════════════════════════════════════════════════════════ */
import { useMemo, useState } from "react";
import { CenteredOverlay } from "./overlay";
import { Avatar } from "./ui";
import { IconSearch, IconChevronDown, IconCheck } from "./icons";
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
          <p className="text-[15px] font-bold mb-3">{title}</p>
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
                  <span className="block text-[13.5px] font-semibold truncate">{o.label}</span>
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

/* ── TimePicker: lista de horas cada 5 min, SIEMPRE en formato 12h
   (7:00 AM, 2:15 PM…) — reemplaza <input type="time">, cuyo widget
   nativo del navegador se ve en 24h y rompe la regla de "solo 12h en
   toda la app". Guarda/recibe "HH:MM" en 24h (mismo formato de BD). ── */
export function TimePicker({
  value, onChange, placeholder = "Seleccionar hora", className, disabled, stepMin = 5,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string; disabled?: boolean; stepMin?: number;
}) {
  const options = useMemo(() => {
    const opts: SelectOption[] = [];
    for (let m = 0; m < 24 * 60; m += stepMin) {
      const hh = String(Math.floor(m / 60)).padStart(2, "0");
      const mm = String(m % 60).padStart(2, "0");
      const hhmm = `${hh}:${mm}`;
      opts.push({ value: hhmm, label: fmtTime(hhmm), keywords: hhmm });
    }
    return opts;
  }, [stepMin]);

  return (
    <Select
      value={value} onChange={onChange} options={options}
      placeholder={placeholder} title="Seleccionar hora" className={className} disabled={disabled}
      renderTriggerLabel={(v) => fmtTime(v)}
      emptyLabel="Sin horas que coincidan"
    />
  );
}
