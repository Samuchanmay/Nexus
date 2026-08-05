"use client";
/* ═══════════════════════════════════════════════════════════════
   EMET Scheduling System · primitives
   Cáscara compartida de TODOS los pickers del sistema. Un solo shell
   (SchedulingOverlay) + un solo footer (PickerFooter) + helpers.

   - Portado a document.body (igual que CenteredOverlay/Sheet) para
     escapar de cualquier stacking context de un ancestro con
     transform/filter/backdrop-blur.
   - SIEMPRE centrado en pantalla, en CUALQUIER tamaño de viewport:
     no hay modo "bottom sheet" móvil (el grab-handle Android Material
     se eliminó del lenguaje visual de EMET a propósito).
   - Animación: escala .96→1 + opacity 0→100, 200ms ease-out, sin
     rebote. Movimiento reducido respetado por la regla global.
   ═══════════════════════════════════════════════════════════════ */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useMountOnOpen } from "@/lib/use-mount-on-open";

export function cx(...a: (string | false | null | undefined)[]): string {
  return a.filter(Boolean).join(" ");
}

export function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

export function SchedulingOverlay({
  open, onClose, children, width = 380, ariaLabel,
}: {
  open: boolean; onClose: () => void; children: React.ReactNode; width?: number; ariaLabel?: string;
}) {
  const mounted = useMounted();
  const { mounted: showShell, visible } = useMountOnOpen(open, 200);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  if (!mounted || !showShell) return null;

  return createPortal(
    <div
      className="nx-scheduling fixed inset-0 z-[900] flex items-center justify-center px-4"
      style={{
        background: visible ? "rgba(0,0,0,.42)" : "rgba(0,0,0,0)",
        backdropFilter: visible ? "blur(18px) saturate(.75) brightness(.72)" : "blur(0px) saturate(1) brightness(1)",
        WebkitBackdropFilter: visible ? "blur(18px) saturate(.75) brightness(.72)" : "blur(0px) saturate(1) brightness(1)",
        pointerEvents: visible ? "all" : "none",
        transition: "background .2s ease-out, backdrop-filter .2s ease-out",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog" aria-modal="true" aria-label={ariaLabel}
    >
      <div
        className="w-full flex flex-col"
        style={{
          maxWidth: width,
          maxHeight: "min(580px, 84vh)",
          background: "var(--panel)",
          border: "0.5px solid var(--border-2)",
          borderRadius: 24,
          boxShadow: "0 24px 80px rgba(0,0,0,.28), 0 6px 20px rgba(0,0,0,.12)",
          opacity: visible ? 1 : 0,
          transform: visible ? "scale(1)" : "scale(.96)",
          transition: "opacity .2s ease-out, transform .2s ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

export function PickerFooter({
  onCancel, onApply, applyLabel = "Aplicar", onToday,
}: {
  onCancel: () => void; onApply: () => void; applyLabel?: string; onToday?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 shrink-0"
      style={{ padding: "14px 28px 22px", borderTop: "0.5px solid var(--border)" }}>
      <div className="flex items-center gap-2">
        <button type="button" onClick={onCancel}
          className="btn-tertiary h-9 px-3 rounded-full text-[13.5px]">
          Cancelar
        </button>
        {onToday && (
          <button type="button" onClick={onToday}
            className="btn-tertiary h-9 px-3 rounded-full text-[13.5px]">
            Hoy
          </button>
        )}
      </div>
      <button type="button" onClick={onApply} data-ripple
        className="btn-primary h-9 px-5 rounded-full text-[13.5px]">
        {applyLabel}
      </button>
    </div>
  );
}
