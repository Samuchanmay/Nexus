export type Role = "admin" | "empleado" | "coordinador" | "departamento" | "rh";

export type NavItem = {
  key: string;
  label: string;
  icon: string;
  roles: Role[] | "all";
  section: "inicio" | "trabajo" | "chat" | "personas" | "tiempo" | "reportes" | "recorridos" | "config";
};

/** Navegación única de EMET, organizada por dominio de negocio (no por
    pantalla) — ver "Reorganización del menú principal", Fase 1, 2026-07-31.
    Personas y Tiempo son ahora "hubs": un solo item de sidebar que agrupa
    varias vistas (ver DOMAIN_VIEWS más abajo) presentadas como pestañas
    dentro de la página, no como entradas planas del menú — Fase 2. */
export const NAV: NavItem[] = [
  { key: "hoy", label: "Inicio", icon: "home", roles: "all", section: "inicio" },

  { key: "actividades", label: "Actividades", icon: "layers", roles: "all", section: "trabajo" },
  { key: "solicitudes", label: "Solicitudes", icon: "inbox", roles: ["admin", "coordinador", "departamento"], section: "trabajo" },
  { key: "calendario", label: "Calendario", icon: "calendar", roles: "all", section: "trabajo" },
  { key: "biblioteca", label: "Biblioteca", icon: "book", roles: "all", section: "trabajo" },

  // Aparte de Trabajo a propósito — acceso directo de un clic, no una vista
  // más dentro de otro dominio.
  { key: "chat", label: "Chat", icon: "message", roles: ["admin", "empleado"], section: "chat" },

  // Personas — mismas personas, distintas vistas (ver DOMAIN_VIEWS.personas).
  { key: "personas", label: "Personas", icon: "users", roles: ["admin"], section: "personas" },

  // Tiempo — disponibilidad laboral: autoservicio y gestión conviven en el
  // mismo dominio (ver DOMAIN_VIEWS.tiempo), ya no separados por quién mira.
  { key: "tiempo", label: "Tiempo", icon: "clock", roles: ["admin", "empleado"], section: "tiempo" },

  { key: "reportes", label: "Reportes", icon: "chart", roles: ["admin"], section: "reportes" },

  // Recorridos — demos guiadas para el onboarding del primer login. Solo el
  // admin las crea/edita/publica desde /preptour; los empleados nunca ven
  // esta entrada, solo el overlay resultante en su primer login.
  { key: "recorridos", label: "Recorridos", icon: "layers", roles: ["admin"], section: "recorridos" },

  { key: "config", label: "Configuración", icon: "settings", roles: ["admin"], section: "config" },
];

export const SECTIONS: { id: NavItem["section"]; label: string }[] = [
  { id: "inicio", label: "Inicio" },
  { id: "trabajo", label: "Trabajo" },
  { id: "chat", label: "Chat" },
  { id: "personas", label: "Personas" },
  { id: "tiempo", label: "Tiempo" },
  { id: "reportes", label: "Reportes" },
  { id: "recorridos", label: "Recorridos" },
  { id: "config", label: "Configuración" },
];

export function navFor(role: Role): NavItem[] {
  return NAV.filter((i) => i.roles === "all" || i.roles.includes(role));
}

const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrador", empleado: "Colaborador", coordinador: "Coordinador",
  departamento: "Departamento", rh: "Recursos Humanos",
};

export function roleLabel(role: Role): string {
  return ROLE_LABEL[role] ?? role;
}

/** key → URL por rol. Única fuente de verdad de rutas — la usan tanto el
    sidebar (vía los items de NAV) como DomainTabs (vía DOMAIN_VIEWS), así
    nunca hay dos lugares con la misma URL escrita a mano. Las llaves de
    vistas internas (empleados/equipo/jornada/vacaciones/...) siguen vivas
    aquí aunque ya no aparezcan como item propio en NAV — DomainTabs las
    resuelve por su cuenta. */
export const HREF: Record<Role, Record<string, string>> = {
  admin: {
    hoy: "/admin",
    actividades: "/admin/proyectos",
    solicitudes: "/admin/solicitudes",
    calendario: "/admin/calendario",
    chat: "/chat",
    biblioteca: "/admin/biblioteca",
    reportes: "/admin/reportes",
    config: "/admin/config",
    // Hubs — landing por defecto de cada dominio.
    personas: "/admin/empleados",
    tiempo: "/comunicacion/jornada",
    // Vistas internas de Personas/Tiempo (ver DOMAIN_VIEWS).
    empleados: "/admin/empleados",
    equipo: "/admin/equipo",
    jornada: "/comunicacion/jornada",
    vacaciones: "/admin/vacaciones",
    incidencias: "/admin/incidencias",
    asistencia: "/admin/nexus",
    "dias-inhabiles": "/admin/dias-inhabiles",
    recorridos: "/preptour",
  },
  empleado: {
    hoy: "/comunicacion",
    actividades: "/comunicacion/actividades",
    calendario: "/comunicacion/calendario",
    biblioteca: "/comunicacion/biblioteca",
    chat: "/chat",
    tiempo: "/comunicacion/jornada",
    jornada: "/comunicacion/jornada",
    vacaciones: "/comunicacion/vacaciones",
    incidencias: "/comunicacion/incidencias",
  },
  coordinador: { hoy: "/coordinador" },
  departamento: { hoy: "/coordinador" },
  rh: { hoy: "/rh" },
};

/** Una vista dentro de un dominio-hub (Personas/Tiempo) — se resuelve a una
    URL real vía HREF[role][key], nunca inventa una ruta propia. */
export interface DomainView {
  key: string;
  label: string;
  icon: string;
  roles: Role[];
}

/** Vistas de cada dominio-hub, en el orden en que deben aparecer como
    pestañas. Solo declara CUÁLES existen y para qué roles — el href de cada
    una se resuelve siempre contra HREF[role][key] (fuente única). */
export const DOMAIN_VIEWS: Record<string, DomainView[]> = {
  personas: [
    { key: "empleados", label: "Lista", icon: "users", roles: ["admin"] },
    { key: "equipo", label: "Carga", icon: "chart", roles: ["admin"] },
  ],
  tiempo: [
    { key: "jornada", label: "Mi día", icon: "clock", roles: ["admin", "empleado"] },
    { key: "vacaciones", label: "Vacaciones", icon: "plane", roles: ["admin", "empleado"] },
    { key: "incidencias", label: "Incidencias", icon: "alert", roles: ["admin", "empleado"] },
    { key: "asistencia", label: "Asistencia", icon: "clock", roles: ["admin"] },
    { key: "dias-inhabiles", label: "Días inhábiles", icon: "calendar", roles: ["admin"] },
  ],
};

/** Vistas de `domain` visibles para `role`, cada una ya resuelta a su URL
    real. Devuelve [] si el dominio no existe o el rol no tiene HREF para
    ninguna vista (nunca inventa un destino que no exista). */
export function domainViewsFor(domain: string, role: Role): (DomainView & { href: string })[] {
  const map = HREF[role] ?? {};
  return (DOMAIN_VIEWS[domain] ?? [])
    .filter((v) => v.roles.includes(role) && map[v.key])
    .map((v) => ({ ...v, href: map[v.key] }));
}
