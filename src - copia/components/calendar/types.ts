"use client";

/* ── Calendar Engine · tipos (EMET-CALENDAR-ENGINE.md §3.2) ──
   Todo dato que el calendario muestra se normaliza a CalendarEvent[]. El
   motor no conoce tablas de Supabase ni APIs de Google: recibe eventos. */

export type CalendarView = "agenda" | "day" | "week" | "month" | "year";

export type CalendarEventKind =
  | "actividad"            // fechas límite de proyectos/actividades Emet
  | "proyecto"
  | "evento_institucional"
  | "vacacion"
  | "permiso"
  | "incapacidad"
  | "home_office"
  | "comision"
  | "cumpleanos"
  | "inhabil"
  | "google"               // eventos sincronizados de Google Calendar
  | "recordatorio"
  | "disponibilidad";

export interface CalendarEvent {
  id: string;
  kind: CalendarEventKind;
  title: string;
  start: string;            // ISO "YYYY-MM-DD" o "YYYY-MM-DDTHH:mm"
  end: string;
  allDay: boolean;
  /** Participante/duenio — para vacaciones, cumpleaños, actividades. */
  user?: { id: string; display_name: string; nexus_color: string | null; avatar_url?: string | null };
  location?: string | null;
  notes?: string | null;
  status?: "confirmado" | "pendiente" | "cancelado";
  source: "db" | "google" | "computado";
  meta?: Record<string, unknown>;
}

/** Capa/fuente activa del calendario — cada una con su color semántico. */
export interface CalendarLayer {
  key: string;
  label: string;
  /** CSS variable de color, p.ej. "var(--ev-purple)". */
  color: string;
  active: boolean;
}

/* ── Paleta semántica (EMET-CALENDAR-ENGINE.md §7) ──
   kind → CSS var de color. El azul es acción, no decoración. */
export const EVENT_COLOR: Record<CalendarEventKind, string> = {
  actividad: "var(--ev-blue)",
  proyecto: "var(--ev-blue)",
  evento_institucional: "var(--ev-blue)",
  vacacion: "var(--ev-purple)",
  permiso: "var(--ev-red)",
  incapacidad: "var(--ev-red)",
  home_office: "var(--ev-red)",
  comision: "var(--ev-red)",
  cumpleanos: "var(--ev-yellow)",
  inhabil: "var(--ev-gray)",
  google: "var(--ev-blue)",
  recordatorio: "var(--ev-orange)",
  disponibilidad: "var(--ev-green)",
};

export function eventColor(kind: CalendarEventKind): string {
  return EVENT_COLOR[kind] ?? "var(--ev-blue)";
}

/** Etiqueta corta por tipo (para tooltips y la leyenda). */
export const KIND_LABEL: Record<CalendarEventKind, string> = {
  actividad: "Actividad",
  proyecto: "Proyecto",
  evento_institucional: "Institucional",
  vacacion: "Vacaciones",
  permiso: "Permiso",
  incapacidad: "Incapacidad",
  home_office: "Home office",
  comision: "Comisión",
  cumpleanos: "Cumpleaños",
  inhabil: "Día inhábil",
  google: "Google Calendar",
  recordatorio: "Pendiente",
  disponibilidad: "Disponible",
};

export function eventLabel(kind: CalendarEventKind): string {
  return KIND_LABEL[kind] ?? "Evento";
}

/** ¿Este evento cae en la fecha ISO dada? (allDay o con hora). */
export function eventOnDate(ev: CalendarEvent, date: string): boolean {
  const s = ev.start.slice(0, 10);
  const e = ev.end.slice(0, 10);
  return date >= s && date <= e;
}
