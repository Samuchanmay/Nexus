"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";
type ThemeCtx = { theme: Theme; toggle: () => void; set: (t: Theme) => void };

const Ctx = createContext<ThemeCtx>({ theme: "light", toggle: () => {}, set: () => {} });

/**
 * Provider de tema de Emet. El arranque real (evitar parpadeo) vive en
 * layout.tsx, que ya aplica data-theme="dark" antes del render.
 *
 * IMPORTANTE: el estado inicial NO se lee del atributo data-theme del DOM,
 * sino de localStorage/preferencia de sistema (misma regla que el script
 * inline de layout.tsx). Se confirmó en producción que en rutas pesadas y
 * force-dynamic (ej. /chat, con varias consultas async antes del primer
 * render) el atributo data-theme puede quedar limpiado por la hidratación
 * tardía aunque localStorage siga correcto — leer el DOM en ese momento
 * propaga el valor ya roto. Además, si el mount detecta que el DOM no
 * coincide con la fuente de verdad, lo corrige (auto-sanación) en vez de
 * quedarse en modo claro hasta que el usuario lo note.
 */
function readStoredTheme(): Theme {
  try {
    const saved = localStorage.getItem("nexus-theme");
    if (saved === "dark" || saved === "light") return saved;
  } catch {}
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof document === "undefined") return "light";
    return readStoredTheme();
  });

  // Auto-sanación: si el atributo del DOM no coincide con la fuente de
  // verdad (localStorage/sistema) al montar este provider, lo corrige.
  useEffect(() => {
    const el = document.documentElement;
    const domIsDark = el.getAttribute("data-theme") === "dark";
    if ((theme === "dark") !== domIsDark) {
      if (theme === "dark") el.setAttribute("data-theme", "dark");
      else el.removeAttribute("data-theme");
    }
  }, [theme]);

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
