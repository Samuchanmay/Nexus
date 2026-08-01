"use client";
import { useCallback, useRef, useState } from "react";

/**
 * Primitivo de gesto horizontal compartido por "deslizar mensaje para
 * responder" y "deslizar fila de conversación para acciones rápidas".
 * Pointer Events (no solo touch) para que funcione con mouse en escritorio
 * también — el documento de mejoras señalaba justo esto como falta en el
 * drag del Sheet, mismo criterio aplicado aquí desde el principio.
 */
export function useSwipeGesture(opts: {
  /** Máximo desplazamiento visual permitido a cada lado, en px. */
  maxOffset?: number;
  /** A partir de qué desplazamiento se considera "swipe completo" al soltar. */
  threshold?: number;
  onSwipeLeftComplete?: () => void;
  onSwipeRightComplete?: () => void;
  /** Si es false, el offset regresa a 0 al soltar (patrón "responder": solo dispara la acción, no se queda abierto). */
  stayOpenOnComplete?: boolean;
}) {
  const { maxOffset = 88, threshold = 56, onSwipeLeftComplete, onSwipeRightComplete, stayOpenOnComplete = false } = opts;
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startDx = useRef(0);
  const pointerId = useRef<number | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    // Solo botón primario / touch / pen — evita interceptar clic derecho.
    if (e.pointerType === "mouse" && e.button !== 0) return;
    startX.current = e.clientX;
    startDx.current = dx;
    pointerId.current = e.pointerId;
    setDragging(true);
    // Captura el puntero en el elemento: sin esto, si el dedo/mouse se
    // mueve rápido y sale del área del elemento, el navegador puede dejar
    // de mandar los eventos move/up a este handler — el swipe se "traba"
    // a medio camino. Es el mismo motivo por el que el drag-to-close del
    // Sheet solo funcionaba en touch antes de este mismo tratamiento.
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }, [dx]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (pointerId.current !== e.pointerId) return;
    const raw = startDx.current + (e.clientX - startX.current);
    setDx(Math.max(-maxOffset, Math.min(maxOffset, raw)));
  }, [maxOffset]);

  const finish = useCallback((e?: React.PointerEvent) => {
    setDragging(false);
    if (e) (e.target as Element).releasePointerCapture?.(e.pointerId);
    pointerId.current = null;
    if (dx <= -threshold) {
      onSwipeLeftComplete?.();
      setDx(stayOpenOnComplete ? -maxOffset : 0);
      return;
    }
    if (dx >= threshold) {
      onSwipeRightComplete?.();
      setDx(stayOpenOnComplete ? maxOffset : 0);
      return;
    }
    setDx(0);
  }, [dx, threshold, maxOffset, stayOpenOnComplete, onSwipeLeftComplete, onSwipeRightComplete]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (pointerId.current !== e.pointerId) return;
    finish(e);
  }, [finish]);

  const reset = useCallback(() => setDx(0), []);

  return {
    dx,
    dragging,
    reset,
    bind: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
  };
}
