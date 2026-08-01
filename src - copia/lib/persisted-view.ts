"use client";
import { useCallback, useEffect, useState } from "react";

/** Preferencia de vista persistida (localStorage): Tabs, Segmented Controls,
    selector Día/Semana/Mes, Tabla/Gantt/Calendario, y similares. No se debe
    reiniciar al salir y volver a entrar a la pantalla (punto 1 del pulido UX).
    Se guarda por navegador/dispositivo — en la práctica, por usuario, ya que
    cada persona entra desde su propia sesión. */
export function usePersistedView<T extends string>(
  key: string,
  options: readonly T[],
  fallback: T
): [T, (v: T) => void] {
  const storageKey = `nx.view.${key}`;
  const [value, setValue] = useState<T>(fallback);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved && (options as readonly string[]).includes(saved)) setValue(saved as T);
    } catch {
      /* localStorage no disponible (modo privado, SSR) — se usa el fallback */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const set = useCallback((v: T) => {
    setValue(v);
    try { window.localStorage.setItem(storageKey, v); } catch { /* ignore */ }
  }, [storageKey]);

  return [value, set];
}
