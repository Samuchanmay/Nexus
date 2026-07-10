"use client";
/**
 * AppShell — conecta el Shell de Nexus OS (diseño/tema/spotlight, ya construido
 * en /os) con la navegación real de la app (rutas de Next.js, sin estado local).
 * Cada rol solo ve los ítems de NAV que ya tienen una página real (HREF abajo);
 * lo que aún no existe simplemente no aparece (nada de datos/enlaces inventados).
 */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo } from "react";
import { ThemeProvider } from "@/lib/theme";
import { Shell, type ShellUser } from "./shell";
import { Icon } from "./icons";
import { cx } from "./ui";
import { navFor, type Role } from "@/lib/nav";
export { roleLabel } from "@/lib/nav";

const HREF: Record<Role, Record<string, string>> = {
  admin: {
    hoy: "/admin",
    actividades: "/admin/proyectos",
    solicitudes: "/admin/solicitudes",
    calendario: "/admin/calendario",
    asistencia: "/admin/nexus",
    jornada: "/empleado/jornada",
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
    hoy: "/empleado",
    calendario: "/empleado/calendario",
    jornada: "/empleado/jornada",
    vacaciones: "/empleado/vacaciones",
    incidencias: "/empleado/incidencias",
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

  // Barra superior (desktop/tablet): botón con texto. En celular se oculta
  // porque no cabe bien junto a buscador/tema/campana — ahí usamos el FAB.
  const fichar = ficharAction ? (
    <Link
      href="/fichar"
      className={cx(
        "hidden sm:inline-flex items-center gap-1.5 h-8 px-3 rounded-sm text-[13px] font-semibold whitespace-nowrap",
        "bg-surface-2 text-text-1 border border-border hover:bg-hover transition-colors duration-150"
      )}
    >
      <Icon name="clock" size={15} /> Registrar entrada/salida
    </Link>
  ) : null;

  // Celular: botón flotante fijo (abajo-derecha), igual de accesible con el
  // pulgar que la pestaña "Fichar" que tenía el diseño anterior.
  const ficharFab = ficharAction ? (
    <Link
      href="/fichar"
      aria-label="Registrar entrada o salida"
      className="sm:hidden fixed z-40 grid place-items-center h-14 w-14 rounded-full text-white shadow-nx active:scale-95 transition-transform"
      style={{ right: "18px", bottom: "max(18px, env(safe-area-inset-bottom))", background: "var(--accent)" }}
    >
      <Icon name="clock" size={22} />
    </Link>
  ) : null;

  return (
    <ThemeProvider>
      <Shell
        role={role}
        user={user}
        active={active}
        onNavigate={go}
        title={TITLES[active] ?? "Nexus"}
        actions={<>{fichar}{actions}</>}
      >
        {children}
      </Shell>
      {ficharFab}
    </ThemeProvider>
  );
}
