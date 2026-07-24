"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Ctx = { action: ReactNode; setAction: (node: ReactNode) => void };
const HeaderActionsCtx = createContext<Ctx>({ action: null, setAction: () => {} });

/** Envuelve el árbol de un módulo para que sus pantallas puedan registrar
    una acción contextual en el Header (ver useHeaderAction) y el Shell
    pueda pintarla (ver useHeaderActionSlot). */
export function HeaderActionsProvider({ children }: { children: ReactNode }) {
  const [action, setAction] = useState<ReactNode>(null);
  return <HeaderActionsCtx.Provider value={{ action, setAction }}>{children}</HeaderActionsCtx.Provider>;
}

/** Consumido por AppShell: la acción contextual del módulo activo, si alguno la registró. */
export function useHeaderActionSlot(): ReactNode {
  return useContext(HeaderActionsCtx).action;
}

/** Usado por cada page/client.tsx que quiera su propio botón en el Header
    (ej. "Exportar CSV" en Asistencia, "Agregar personal" en Equipo) en vez
    de un botón de sistema fijo. Se limpia solo al desmontar o cambiar. */
export function useHeaderAction(node: ReactNode) {
  const { setAction } = useContext(HeaderActionsCtx);
  useEffect(() => {
    setAction(node);
    return () => setAction(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node]);
}
