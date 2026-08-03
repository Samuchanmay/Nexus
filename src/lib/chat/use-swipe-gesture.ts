"use client";
import { useCallback, useRef, useState } from "react";

/**
 * Primitivo de gesto horizontal compartido por "deslizar mensaje para
 * responder" y "deslizar fila de conversación para acciones rápidas".
 * Pointer Events (no solo touch) para que funcione con mouse en escritorio.
 *
 * Dinámica estilo Signal / Apple Mail:
 *   · 0–umbral      → la pieza solo sigue al dedo (translateX, GPU).
 *   · umbral–full   → al soltar, la franja de acciones queda revelada
 *                     (stayOpenOnComplete) para tocar un botón.
 *   · full+         → al soltar se EJECUTA onSwipe*Complete y la pieza
 *                     regresa con resorte (patrón lista, executeOnFullSwipe).
 *   · Más allá del límite hay resistencia (rubber band), no un tope duro:
 *     el dedo sigue arrastrando pero la pieza cede 1/4 del recorrido.
 *   · Al cruzar el umbral durante el arrastre se lanza una vibración corta
 *     (háptica en móvil) que avisa "la acción está lista" — una sola vez
 *     por gesto.
 *
 * Nunca se toca width/left/margin durante el gesto: solo transform.
 */
export function useSwipeGesture(opts: {
  /** Máximo desplazamiento visual permitido a cada lado, en px. */
  maxOffset?: number;
  /** A partir de qué desplazamiento se considera "swipe completo" al soltar. */
  threshold?: number;
  onSwipeLeftComplete?: () => void;
  onSwipeRightComplete?: () => void;
  /** true = al soltar pasado el umbral la franja queda abierta para tocar
      (patrón lista); false = ejecutar la acción y cerrar (patrón responder). */
  stayOpenOnComplete?: boolean;
  /** true = soltar más allá de ~85% del límite ejecuta y cierra (Signal). */
  executeOnFullSwipe?: boolean;
}) {
  const {
    maxOffset = 88, threshold = 56,
    onSwipeLeftComplete, onSwipeRightComplete,
    stayOpenOnComplete = false, executeOnFullSwipe = false,
  } = opts;
  const fullSwipe = Math.round(maxOffset * 0.85);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startDx = useRef(0);
  const pointerId = useRef<number | null>(null);
  const hapticked = useRef(false);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    // Solo botón primario / touch / pen — evita interceptar clic derecho.
    if (e.pointerType === "mouse" && e.button !== 0) return;
    startX.current = e.clientX;
    startDx.current = dx;
    pointerId.current = e.pointerId;
    hapticked.current = false;
    setDragging(true);
    // Captura el puntero en el elemento: sin esto, si el dedo/mouse se
    // mueve rápido y sale del área del elemento, el navegador puede dejar
    // de mandar los eventos move/up a este handler — el swipe se "traba"
    // a medio camino.
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }, [dx]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (pointerId.current !== e.pointerId) return;
    const raw = startDx.current + (e.clientX - startX.current);
    let next = Math.max(-maxOffset, Math.min(maxOffset, raw));
    // Rubber band: más allá del límite el dedo sigue pero la pieza se
    // resiste (solo cede 1/4 del exceso) — muelle, no tope duro.
    const over = Math.abs(raw) - maxOffset;
    if (over > 0) {
      const dir = raw < 0 ? -1 : 1;
      next = dir * (maxOffset + Math.round(over * 0.25));
    }
    setDx(next);
    // Háptica al cruzar el umbral durante el arrastre (una vez por gesto).
    const crossed = Math.abs(next) >= threshold;
    if (crossed && !hapticked.current) {
      hapticked.current = true;
      try { navigator.vibrate?.(8); } catch { /* sin permiso de vibración */ }
    } else if (!crossed) {
      hapticked.current = false;
    }
  }, [maxOffset, threshold]);

  const finish = useCallback((e?: React.PointerEvent) => {
    setDragging(false);
    if (e) (e.target as Element).releasePointerCapture?.(e.pointerId);
    pointerId.current = null;
    const dir = dx < 0 ? "left" : dx > 0 ? "right" : null;
    const abs = Math.abs(dx);
    if (!dir || abs < threshold) {
      setDx(0);
      return;
    }
    if (stayOpenOnComplete) {
      // Patrón lista: swipe completo ejecuta la acción del borde; swipe
      // parcial deja la franja abierta para tocar el botón deseado.
      if (executeOnFullSwipe && abs >= fullSwipe) {
        if (dir === "left") onSwipeLeftComplete?.();
        else onSwipeRightComplete?.();
        setDx(0);
      } else {
        setDx(dir === "left" ? -maxOffset : maxOffset);
      }
      return;
    }
    // Patrón responder: ejecuta al soltar pasado el umbral y cierra.
    if (dir === "left") onSwipeLeftComplete?.();
    else onSwipeRightComplete?.();
    setDx(0);
  }, [dx, threshold, fullSwipe, maxOffset, stayOpenOnComplete, executeOnFullSwipe, onSwipeLeftComplete, onSwipeRightComplete]);

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
