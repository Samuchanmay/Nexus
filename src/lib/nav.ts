export type Role = "admin" | "empleado" | "coordinador" | "departamento" | "rh";

export type NavItem = {
  key: string;
  label: string;
  icon: string;
  roles: Role[] | "all";
  section: "trabajo" | "personal" | "gestion";
};

/** Navegación única de Nexus. El shell filtra por rol con navFor(). */
export const NAV: NavItem[] = [
  { key: "hoy", label: "Hoy", icon: "home", roles: "all", section: "trabajo" },
  { key: "actividades", label: "Actividades", icon: "layers", roles: "all", section: "trabajo" },
  { key: "solicitudes", label: "Solicitudes", icon: "inbox", roles: ["admin", "coordinador", "departamento"], section: "trabajo" },
  { key: "calendario", label: "Calendario", icon: "calendar", roles: "all", section: "trabajo" },
  { key: "biblioteca", label: "Biblioteca", icon: "book", roles: "all", section: "trabajo" },

  { key: "jornada", label: "Mi jornada", icon: "clock", roles: ["admin", "empleado"], section: "personal" },
  { key: "vacaciones", label: "Vacaciones", icon: "sun", roles: "all", section: "personal" },
  { key: "incidencias", label: "Incidencias", icon: "alert", roles: "all", section: "personal" },

  { key: "equipo", label: "Carga del equipo", icon: "users", roles: ["admin"], section: "gestion" },
  { key: "empleados", label: "Empleados", icon: "users", roles: ["admin"], section: "gestion" },
  { key: "asistencia", label: "Asistencia", icon: "clock", roles: ["admin"], section: "gestion" },
  { key: "dias-inhabiles", label: "Días inhábiles", icon: "calendar", roles: ["admin"], section: "gestion" },
  { key: "reportes", label: "Reportes", icon: "chart", roles: ["admin"], section: "gestion" },
  { key: "config", label: "Configuración", icon: "settings", roles: ["admin"], section: "gestion" },
];

export const SECTIONS: { id: NavItem["section"]; label: string }[] = [
  { id: "trabajo", label: "Trabajo" },
  { id: "personal", label: "Personal" },
  { id: "gestion", label: "Gestión" },
];

export function navFor(role: Role): NavItem[] {
  return NAV.filter((i) => i.roles === "all" || i.roles.includes(role));
}
