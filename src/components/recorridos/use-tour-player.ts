"use client";
/**
 * useTourPlayer — control de reproducción de un recorrido (demos).
 * Maneja el índice de pantalla, avance/retroceso y autoplay con play/pause.
 * Cada `intervalMs` (por defecto 3s) avanza una pantalla; al llegar a la
 * última detiene el autoplay y llama a `onEnd` (si se pasó). Al cambiar
 * `resetKey` (demo distinta) reinicia el índice y pausa.
 */
import { useCallback, useEffect, useRef, useState } from "react";

type Options = {
  total: number;
  intervalMs?: number;
  onEnd?: () => void;
  resetKey?: string;
};

export function useTourPlayer({ total, intervalMs = 3000, onEnd, resetKey }: Options) {
  const [screenIdx, setScreenIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const onEndRef = useRef(onEnd);

  useEffect(() => {
    onEndRef.current = onEnd;
  }, [onEnd]);

  const goTo = useCallback((i: number) => {
    setScreenIdx(Math.max(0, Math.min(Math.max(total - 1, 0), i)));
  }, [total]);

  const next = useCallback(() => {
    setScreenIdx((i) => Math.min(Math.max(total - 1, 0), i + 1));
  }, [total]);

  const prev = useCallback(() => {
    setScreenIdx((i) => Math.max(0, i - 1));
  }, []);

  const play = useCallback(() => {
    if (total <= 1) return;
    setPlaying(true);
  }, [total]);

  const pause = useCallback(() => setPlaying(false), []);

  useEffect(() => {
    if (!playing || total <= 1) return;
    const t = setTimeout(() => {
      if (screenIdx >= total - 1) {
        setPlaying(false);
        onEndRef.current?.();
        return;
      }
      setScreenIdx(screenIdx + 1);
    }, intervalMs);
    return () => clearTimeout(t);
  }, [playing, screenIdx, total, intervalMs]);

  useEffect(() => {
    setScreenIdx(0);
    setPlaying(false);
  }, [resetKey]);

  return {
    screenIdx,
    playing,
    play,
    pause,
    next,
    prev,
    goTo,
    isLast: screenIdx >= total - 1,
  };
}
