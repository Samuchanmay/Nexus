"use client";
import { useEffect, useState } from "react";

/**
 * Mantiene un overlay (Sheet/Dialog/Popover/Drawer) montado en el DOM SOLO
 * mientras está abierto o mientras termina su animación de salida — nunca
 * más tiempo. Antes, algunos overlays (Sheet, panel de Notificaciones) se
 * quedaban para siempre en el árbol alternando nada más pointer-events /
 * opacidad, lo que podía dejar la app "atorada" (sidebar y botones sin
 * responder) si ese estado no volvía a "cerrado" correctamente. El resto
 * del Design System (Drawer, Spotlight, Menu, DateSheet) ya desmonta por
 * completo al cerrar — este hook lleva Sheet/Notificaciones al mismo
 * estándar, con animación de salida incluida.
 */
export function useMountOnOpen(open: boolean, exitMs: number) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setVisible(false);
    const t = setTimeout(() => setMounted(false), exitMs);
    return () => clearTimeout(t);
  }, [open, exitMs]);

  return { mounted, visible };
}
