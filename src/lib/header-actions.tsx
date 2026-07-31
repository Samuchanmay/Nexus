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
    de un botón de sistema fijo. Se limpia solo al desmontar.
    Recibe una FÁBRICA (() => ReactNode), no el nodo ya creado: un JSX
    literal pasado directo (ej. `useHeaderAction(<button>...)`) es un objeto
    nuevo en cada render del caller, así que un `useEffect` con ese nodo en
    sus deps se dispara en cada render — y si algo en la cadena de ese
    contexto termina re-renderizando de vuelta al caller (aunque sea
    indirectamente), se vuelve un ciclo que consume CPU sin arrojar ningún
    error (visto en Directorio: clics "congelados" sin nada en consola). La
    fábrica se invoca UNA sola vez al montar — ver bug real documentado en
    empleados/client.tsx. */
export function useHeaderAction(render: () => ReactNode) {
  const { setAction } = useContext(HeaderActionsCtx);
  useEffect(() => {
    setAction(render());
    return () => setAction(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
