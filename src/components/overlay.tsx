"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useMountOnOpen } from "@/lib/use-mount-on-open";

function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

/**
 * CenteredOverlay — la cáscara única de Emet para overlays "de selección"
 * (Popover, Select, TimePicker, DatePicker): SIEMPRE centrado en pantalla,
 * nunca debajo del input ni pegado a un borde. Fondo con blur + overlay
 * oscuro ligero. Animación 96%→100% escala + 0→100% opacity, 180ms, sin
 * rebote — reemplaza el spring/bounce (cubic-bezier(.34,1.4,.64,1)) que
 * usaban nx-pop/nx-datesheet-pop antes de esta unificación.
 *
 * Portado a document.body (igual que Sheet/DateSheet) para escapar de
 * cualquier stacking context de un Sheet/Drawer ancestro (backdrop-blur o
 * transform rompen z-index normal) — así un selector abierto DESDE un
 * Drawer de edición siempre queda por encima de él.
 */
export function CenteredOverlay({
  open, onClose, children, width = 360, ariaLabel,
}: {
  open: boolean; onClose: () => void; children: React.ReactNode; width?: number; ariaLabel?: string;
}) {
  const mounted = useMounted();
  const { mounted: showShell, visible } = useMountOnOpen(open, 180);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  if (!mounted || !showShell) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[900] flex items-center justify-center px-4"
      style={{
        // Scrim Signal (spec chat §1): oscurece + blur + baja saturación/
        // contraste; el fondo desaparece visualmente mientras el overlay vive.
        background: visible ? "rgba(0,0,0,.42)" : "rgba(0,0,0,0)",
        backdropFilter: visible ? "blur(18px) saturate(.75) brightness(.72)" : "blur(0px) saturate(1) brightness(1)",
        WebkitBackdropFilter: visible ? "blur(18px) saturate(.75) brightness(.72)" : "blur(0px) saturate(1) brightness(1)",
        // CAUSA RAÍZ del bloqueo intermitente en Equipo (y cualquier pantalla
        // con Select/TimePicker/DatePicker dentro de un Drawer): sin esto,
        // durante los ~180ms de la animación de salida el backdrop de
        // página completa (z-900) seguía montado Y CLICKEABLE aunque ya
        // fuera invisible (visible=false solo cambiaba el fondo/blur, nunca
        // pointer-events) — el siguiente clic del usuario en CUALQUIER
        // parte de la pantalla lo absorbía este overlay fantasma en vez de
        // llegar al botón real. Mismo patrón ya corregido en Sheet/
        // Notificaciones; a este componente (usado por Select y TimePicker,
        // dos de los controles más usados en el Drawer de Equipo) nunca se
        // le había aplicado.
        pointerEvents: visible ? "all" : "none",
        transition: "background .18s ease-out, backdrop-filter .18s ease-out",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog" aria-modal="true" aria-label={ariaLabel}
    >
      <div
        className="w-full flex flex-col"
        style={{
          maxWidth: width,
          maxHeight: "min(520px, 80vh)",
          background: "var(--panel)", border: "1px solid var(--border)",
          borderRadius: 14,
          boxShadow: "0 20px 60px rgba(0,0,0,.22)",
          opacity: visible ? 1 : 0,
          transform: visible ? "scale(1)" : "scale(.96)",
          transition: "opacity .18s ease-out, transform .18s ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
