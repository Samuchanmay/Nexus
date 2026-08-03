"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/os/icons";

/** Menú contextual de clic derecho — estilo Signal/WhatsApp Desktop: aparece
    en el cursor con scale+fade (nx-menu-in, 160ms), se cierra con clic
    afuera, Esc o pérdida de foco. Se recorta al viewport (margen 8px). */
export function ContextMenu({
  x, y, onClose, children,
}: { x: number; y: number; onClose: () => void; children: ReactNode }) {
  const [pos, setPos] = useState({ x, y });
  const ref = useRef<HTMLDivElement>(null);
  const posRef = useRef({ x, y });
  posRef.current = { x, y };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const { x: px, y: py } = posRef.current;
    setPos({ x: Math.min(px, vw - width - 8), y: Math.min(py, vh - height - 8) });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const onScroll = () => onClose();
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[60]" onMouseDown={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }}>
      <div
        ref={ref}
        onMouseDown={(e) => e.stopPropagation()}
        className="absolute min-w-[200px] rounded-[14px] p-1"
        style={{
          left: pos.x, top: pos.y,
          background: "var(--panel)", border: "0.5px solid var(--border)",
          boxShadow: "var(--shadow-2)", animation: "nx-menu-in .16s var(--ease)",
        }}
        role="menu"
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

/** Fila de acción estándar del menú contextual. */
export function ContextMenuItem({ icon, label, danger, onClick }: {
  icon: string; label: string; danger?: boolean; onClick: () => void;
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-2.5 h-9 rounded-[8px] text-[12.5px] font-semibold text-left hover:bg-hover transition-colors"
      style={{ color: danger ? "var(--danger)" : "var(--text-1)" }}
    >
      <Icon name={icon} size={14} style={{ color: danger ? "var(--danger)" : "var(--text-3)", flexShrink: 0 }} aria-hidden />
      {label}
    </button>
  );
}

export function ContextMenuSeparator() {
  return <div className="h-px my-1 mx-1" style={{ background: "var(--border)" }} role="separator" />;
}
