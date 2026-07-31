"use client";
/**
 * AppShell — conecta el Shell de Nexus OS (diseño/tema/spotlight, ya construido
 * en /os) con la navegación real de la app (rutas de Next.js, sin estado local).
 * Cada rol solo ve los ítems de NAV que ya tienen una página real (HREF abajo);
 * lo que aún no existe simplemente no aparece (nada de datos/enlaces inventados).
 */
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useRef } from "react";
import { ThemeProvider } from "@/lib/theme";
import { Shell, type ShellUser } from "./shell";
import { HeaderActionsProvider, useHeaderActionSlot } from "@/lib/header-actions";
import { navFor, domainViewsFor, HREF, type Role } from "@/lib/nav";
export { roleLabel } from "@/lib/nav";

const TITLES: Record<string, string> = {
  hoy: "Inicio", actividades: "Actividades", solicitudes: "Solicitudes", calendario: "Calendario",
  biblioteca: "Biblioteca", chat: "Chat", personas: "Personas", tiempo: "Tiempo",
  reportes: "Reportes", config: "Configuración",
};

// FASE W1 — antes, cualquier sub-página de Configuración (Colores,
// Horarios, Pausa activa, etc.) colapsaba al mismo título genérico
// "Configuración" en la barra superior fija, aunque el propio contenido de
// la página ya mostrara su título específico (PageHeader propio) — dos
// títulos distintos apilados en la misma pantalla. Un mapa por ruta exacta,
// consultado antes que TITLES[active], resuelve esto sin tocar la
// navegación ni el resto del header. FASE 2 — mismo mecanismo para las
// vistas internas de los dominios-hub Personas/Tiempo (el header ya no dice
// solo "Personas" en /admin/equipo, dice "Personas · Carga").
const SUBTITLES: Record<string, string> = {
  "/admin/config/colores": "Colores de equipo",
  "/admin/config/dispositivos": "Dispositivos",
  "/admin/config/estados-jornada": "Estados de jornada",
  "/admin/config/gps": "Zona GPS",
  "/admin/config/horarios": "Horarios",
  "/admin/config/pausa-activa": "Pausa activa",
  "/admin/config/tipos-actividad": "Tipos de actividad",
  "/admin/empleados": "Personas · Lista",
  "/admin/equipo": "Personas · Carga",
  "/comunicacion/jornada": "Tiempo · Mi día",
  "/admin/vacaciones": "Tiempo · Vacaciones",
  "/comunicacion/vacaciones": "Tiempo · Vacaciones",
  "/admin/incidencias": "Tiempo · Incidencias",
  "/comunicacion/incidencias": "Tiempo · Incidencias",
  "/admin/nexus": "Tiempo · Asistencia",
  "/admin/dias-inhabiles": "Tiempo · Días inhábiles",
};

export function AppShell({
  role, user, children, actions, ficharAction = false,
}: {
  role: Role;
  user: ShellUser;
  children: React.ReactNode;
  actions?: React.ReactNode;
  /** Muestra el acceso rápido a /fichar (Comenzar/terminar jornada) en la barra superior. */
  ficharAction?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const map = HREF[role] ?? {};
  const items = useMemo(() => navFor(role).filter((i) => map[i.key]), [role, map]);

  const active = useMemo(() => {
    let best = items[0]?.key ?? "hoy";
    let bestLen = -1;
    for (const i of items) {
      // Un dominio-hub (Personas/Tiempo) sigue "activo" en el sidebar aunque
      // estés en cualquiera de sus vistas internas (DomainTabs), no solo en
      // el href principal del hub — si no, pasar a la pestaña "Carga" apaga
      // el resaltado de "Personas" sin motivo.
      const candidates = [map[i.key], ...domainViewsFor(i.key, role).map((v) => v.href)].filter(Boolean) as string[];
      for (const href of candidates) {
        const matches = pathname === href || pathname.startsWith(href + "/");
        if (matches && href.length > bestLen) { best = i.key; bestLen = href.length; }
      }
    }
    return best;
  }, [items, map, pathname, role]);

  // Red de seguridad general de navegación — reconstruida desde cero.
  // No dependemos de adivinar en qué página específica se atora la
  // transición cliente de Next.js (router.push): cualquier destino que no
  // complete su cambio de URL en 700ms se resuelve con una navegación
  // completa (window.location.assign), que SIEMPRE funciona porque reinicia
  // el runtime de JS por completo. El usuario nunca vuelve a quedar
  // atrapado sin poder salir de una pantalla, sin importar la causa exacta
  // del estancamiento. En consola queda "[nav-guard]" con cada intento que
  // requirió el respaldo, para tener evidencia real si vuelve a pasar.
  // pendingNav rastrea una navegación en curso: evita que varios clics
  // seguidos (mientras el usuario espera, sin saber si su clic "hizo algo")
  // apilen temporizadores/recargas encimadas. Un segundo clic al MISMO
  // destino mientras ya está en curso simplemente no hace nada nuevo; un
  // clic a OTRO destino cancela el intento anterior y arranca uno nuevo.
  const pendingNav = useRef<{ key: string; fallback: ReturnType<typeof setTimeout>; poll: ReturnType<typeof setInterval>; pollStop: ReturnType<typeof setTimeout> } | null>(null);

  const go = (key: string) => {
    const href = map[key];
    if (!href) return;

    const fromPath = window.location.pathname;
    if (fromPath === href) return;

    if (pendingNav.current) {
      if (pendingNav.current.key === key) return; // ya en curso hacia el mismo lugar
      clearTimeout(pendingNav.current.fallback);
      clearInterval(pendingNav.current.poll);
      clearTimeout(pendingNav.current.pollStop);
      pendingNav.current = null;
    }

    // Feedback inmediato: el cursor cambia en el acto, sin esperar a nada,
    // para que un clic nunca se sienta como que "no pasó nada".
    document.body.style.cursor = "wait";
    const clearPending = () => {
      document.body.style.cursor = "";
      pendingNav.current = null;
    };

    let settled = false;
    const fallback = setTimeout(() => {
      if (settled) return;
      settled = true;
      console.warn(`[nav-guard] router.push("${href}") no completó la transición en 350ms desde ${fromPath}. Forzando navegación completa.`);
      clearPending();
      window.location.assign(href);
    }, 350);

    try {
      router.push(href);
    } catch (err) {
      console.error(`[nav-guard] router.push lanzó una excepción, forzando navegación completa:`, err);
      settled = true;
      clearTimeout(fallback);
      clearPending();
      window.location.assign(href);
      return;
    }

    const poll = setInterval(() => {
      if (window.location.pathname === href) {
        settled = true;
        clearTimeout(fallback);
        clearInterval(poll);
        clearPending();
      }
    }, 30);
    const pollStop = setTimeout(() => clearInterval(poll), 350);

    pendingNav.current = { key, fallback, poll, pollStop };
  };

  // El acceso a Registro de Jornada ya no se duplica en el Header — vive
  // como acción primaria dentro del propio Dashboard, y en celular además
  // como botón central elevado del tab bar (ver MobileBottomNav en shell.tsx).

  return (
    <ThemeProvider>
      <HeaderActionsProvider>
        <AppShellBody
          role={role} user={user} active={active} onNavigate={go}
          title={SUBTITLES[pathname] ?? TITLES[active] ?? "Emet"} actions={actions} ficharAction={ficharAction}
        >
          {children}
        </AppShellBody>
      </HeaderActionsProvider>
    </ThemeProvider>
  );
}

/** Combina la acción contextual que haya registrado la pantalla activa
    (useHeaderAction, ej. "Exportar CSV" en Asistencia) con cualquier acción
    explícita que ya venga del layout — sin duplicar botones (punto 11). */
function AppShellBody({
  role, user, active, onNavigate, title, actions, ficharAction, children,
}: {
  role: Role; user: ShellUser; active: string; onNavigate: (key: string) => void;
  title: string; actions?: React.ReactNode; ficharAction: boolean; children: React.ReactNode;
}) {
  const contextual = useHeaderActionSlot();
  return (
    <Shell
      role={role}
      user={user}
      active={active}
      onNavigate={onNavigate}
      title={title}
      actions={<>{contextual}{actions}</>}
      ficharAction={ficharAction}
    >
      {children}
    </Shell>
  );
}
