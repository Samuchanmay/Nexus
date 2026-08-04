"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";
type ThemeCtx = { theme: Theme; toggle: () => void; set: (t: Theme) => void };

const Ctx = createContext<ThemeCtx>({ theme: "light", toggle: () => {}, set: () => {} });

/**
 * Provider de tema de Emet. El arranque real (evitar parpadeo) vive en
 * layout.tsx, que ya aplica data-theme="dark" antes del render. Aquí
 * inicializamos el estado leyendo el atributo directamente (lazy init)
 * para evitar el flash de tema incorrecto en el primer render.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof document === "undefined") return "light";
    return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  });

  const set = useCallback((t: Theme) => {
    const el = document.documentElement;
    if (t === "dark") el.setAttribute("data-theme", "dark");
    else el.removeAttribute("data-theme");
    try { localStorage.setItem("nexus-theme", t); } catch {}
    setTheme(t);
  }, []);

  const toggle = useCallback(() => set(theme === "dark" ? "light" : "dark"), [theme, set]);

  return <Ctx.Provider value={{ theme, toggle, set }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
