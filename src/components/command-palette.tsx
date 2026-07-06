"use client";
// ═══════════════════════════════════════════════════════════════
//  L7 · Command palette ⌘K (legado cert_nexus)
//  Navegación rápida + acciones. Se abre con ⌘K / Ctrl+K o "/".
// ═══════════════════════════════════════════════════════════════
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export interface Command {
  id: string;
  label: string;
  hint?: string;
  group: string;
  href?: string;
  keywords?: string;
}

export default function CommandPalette({ commands }: { commands: Command[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  /* Atajos globales para abrir/cerrar */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "/" && !open) {
        const el = document.activeElement;
        const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el as HTMLElement)?.isContentEditable;
        if (!typing) { e.preventDefault(); setOpen(true); }
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) { setQ(""); setActive(0); setTimeout(() => inputRef.current?.focus(), 40); }
  }, [open]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return commands;
    return commands.filter((c) =>
      `${c.label} ${c.hint ?? ""} ${c.keywords ?? ""} ${c.group}`.toLowerCase().includes(term)
    );
  }, [q, commands]);

  useEffect(() => { setActive(0); }, [q]);

  const run = (c: Command) => {
    setOpen(false);
    if (c.href) router.push(c.href);
  };

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (filtered[active]) run(filtered[active]); }
  };

  /* Agrupado preservando orden */
  const groups = useMemo(() => {
    const map = new Map<string, Command[]>();
    filtered.forEach((c) => { (map.get(c.group) ?? map.set(c.group, []).get(c.group)!).push(c); });
    return [...map.entries()];
  }, [filtered]);

  let idx = -1;

  return (
    <>
      {/* Disparador visible en la barra */}
      <button onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-2 w-full mb-3 px-3 py-2 rounded-[10px] text-[12.5px]"
        style={{ background: "var(--surface-2)", color: "var(--text-3)", border: "0.5px solid var(--border)" }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
          <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        Buscar…
        <kbd className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded"
          style={{ background: "var(--surface-3)", color: "var(--text-2)" }}>⌘K</kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-[600] flex items-start justify-center pt-[14vh] px-4"
          style={{ background: "rgba(0,0,0,.4)", backdropFilter: "blur(12px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="w-full max-w-[560px] overflow-hidden"
            style={{
              background: "var(--surface)", borderRadius: "18px",
              border: "0.5px solid var(--border-2)", boxShadow: "0 24px 80px rgba(0,0,0,.32)",
            }}
            onKeyDown={onListKey}>
            <div className="flex items-center gap-2.5 px-4"
              style={{ borderBottom: "0.5px solid var(--border)" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth={2} className="w-4 h-4 shrink-0">
                <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Ir a… o escribe una acción"
                className="flex-1 bg-transparent outline-none py-3.5 text-[14.5px]"
                style={{ color: "var(--text-1)" }} />
              <kbd className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0"
                style={{ background: "var(--surface-2)", color: "var(--text-3)" }}>esc</kbd>
            </div>

            <div className="max-h-[52vh] overflow-y-auto py-2">
              {filtered.length === 0 ? (
                <p className="text-[13px] text-center py-8" style={{ color: "var(--text-3)" }}>
                  Sin resultados para “{q}”
                </p>
              ) : groups.map(([group, items]) => (
                <div key={group} className="mb-1">
                  <p className="text-[10.5px] font-bold uppercase tracking-wide px-4 py-1.5" style={{ color: "var(--text-3)" }}>
                    {group}
                  </p>
                  {items.map((c) => {
                    idx++;
                    const isActive = idx === active;
                    return (
                      <button key={c.id} onClick={() => run(c)} onMouseEnter={() => setActive(idx)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left"
                        style={{ background: isActive ? "var(--surface-2)" : "transparent" }}>
                        <span className="text-[13.5px] font-semibold flex-1">{c.label}</span>
                        {c.hint && (
                          <span className="text-[11.5px]" style={{ color: "var(--text-3)" }}>{c.hint}</span>
                        )}
                        {isActive && (
                          <kbd className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                            style={{ background: "var(--surface-3)", color: "var(--text-2)" }}>↵</kbd>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
