export type Role = "admin" | "empleado" | "coordinador" | "departamento" | "rh";

export type NavItem = {
  key: string;
  label: string;
  icon: string;
  roles: Role[] | "all";
  section: "trabajo" | "personal" | "administracion" | "config";
};

/** Navegación única de Nexus. El shell filtra por rol con navFor(). */
export const NAV: NavItem[] = [
  { key: "hoy", label: "Hoy", icon: "home", roles: "all", section: "trabajo" },
  { key: "actividades", label: "Actividades", icon: "layers", roles: "all", section: "trabajo" },
  { key: "solicitudes", label: "Solicitudes", icon: "inbox", roles: ["admin", "coordinador", "departamento"], section: "trabajo" },
  { key: "calendario", label: "Calendario", icon: "calendar", roles: "all", section: "trabajo" },
  { key: "biblioteca", label: "Biblioteca", icon: "book", roles: "all", section: "trabajo" },
  { key: "chat", label: "Chat", icon: "message", roles: ["admin", "empleado"], section: "trabajo" },

  { key: "jornada", label: "Mi día", icon: "clock", roles: ["admin", "empleado"], section: "personal" },
  { key: "vacaciones", label: "Vacaciones", icon: "plane", roles: "all", section: "personal" },
  { key: "incidencias", label: "Incidencias", icon: "alert", roles: "all", section: "personal" },

  { key: "equipo", label: "Carga del equipo", icon: "users", roles: ["admin"], section: "administracion" },
  { key: "empleados", label: "Directorio", icon: "users", roles: ["admin"], section: "administracion" },
  { key: "asistencia", label: "Asistencia", icon: "clock", roles: ["admin"], section: "administracion" },
  { key: "dias-inhabiles", label: "Días inhábiles", icon: "calendar", roles: ["admin"], section: "administracion" },
  { key: "reportes", label: "Reportes", icon: "chart", roles: ["admin"], section: "administracion" },
  { key: "config", label: "Configuración", icon: "settings", roles: ["admin"], section: "config" },
];

/** 4 grupos (no 3): Trabajo / Personal / Administración / Configuración — la
    config ya no vive mezclada dentro de Administración (auditoría, punto 10). */
export const SECTIONS: { id: NavItem["section"]; label: string }[] = [
  { id: "trabajo", label: "Trabajo" },
  { id: "personal", label: "Personal" },
  { id: "administracion", label: "Administración" },
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
