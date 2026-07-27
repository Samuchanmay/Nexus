"use client";
/**
 * AppShell — conecta el Shell de Nexus OS (diseño/tema/spotlight, ya construido
 * en /os) con la navegación real de la app (rutas de Next.js, sin estado local).
 * Cada rol solo ve los ítems de NAV que ya tienen una página real (HREF abajo);
 * lo que aún no existe simplemente no aparece (nada de datos/enlaces inventados).
 */
import { usePathname, useRouter } from "next/navigation";
import { useMemo } from "react";
import { ThemeProvider } from "@/lib/theme";
import { Shell, type ShellUser } from "./shell";
import { HeaderActionsProvider, useHeaderActionSlot } from "@/lib/header-actions";
import { navFor, type Role } from "@/lib/nav";
export { roleLabel } from "@/lib/nav";

const HREF: Record<Role, Record<string, string>> = {
  admin: {
    hoy: "/admin",
    actividades: "/admin/proyectos",
    solicitudes: "/admin/solicitudes",
    calendario: "/admin/calendario",
    asistencia: "/admin/nexus",
    jornada: "/comunicacion/jornada",
    vacaciones: "/admin/vacaciones",
    incidencias: "/admin/incidencias",
    equipo: "/admin/equipo",
    empleados: "/admin/empleados",
    "dias-inhabiles": "/admin/dias-inhabiles",
    config: "/admin/config",
    biblioteca: "/admin/biblioteca",
    reportes: "/admin/reportes",
  },
  empleado: {
    hoy: "/comunicacion",
    actividades: "/comunicacion/actividades",
    calendario: "/comunicacion/calendario",
    biblioteca: "/comunicacion/biblioteca",
    jornada: "/comunicacion/jornada",
    vacaciones: "/comunicacion/vacaciones",
    incidencias: "/comunicacion/incidencias",
  },
  coordinador: { hoy: "/coordinador" },
  departamento: { hoy: "/coordinador" },
  rh: { hoy: "/rh" },
};

const TITLES: Record<string, string> = {
  hoy: "Hoy", actividades: "Actividades", solicitudes: "Solicitudes", calendario: "Calendario",
  biblioteca: "Biblioteca", asistencia: "Asistencia", jornada: "Mi día", vacaciones: "Vacaciones",
  incidencias: "Incidencias", equipo: "Carga del equipo", empleados: "Equipo",
  "dias-inhabiles": "Días inhábiles", reportes: "Reportes", config: "Configuración",
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
      const href = map[i.key];
      const matches = pathname === href || pathname.startsWith(href + "/");
      if (matches && href.length > bestLen) { best = i.key; bestLen = href.length; }
    }
    return best;
  }, [items, map, pathname]);

  const go = (key: string) => {
    const href = map[key];
    if (href) router.push(href);
  };

  // El acceso a Registro de Jornada ya no se duplica en el Header — vive
  // como acción primaria dentro del propio Dashboard, y en celular además
  // como botón central elevado del tab bar (ver MobileBottomNav en shell.tsx).

  return (
    <ThemeProvider>
      <HeaderActionsProvider>
        <AppShellBody
          role={role} user={user} active={active} onNavigate={go}
          title={TITLES[active] ?? "Emet"} actions={actions} ficharAction={ficharAction}
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
