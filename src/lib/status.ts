// ══════════════════════════════════════════════════════════
//  NEXUS · Catálogo único de estados de presencia/asistencia
//  Una sola fuente de vocabulario + color para que Equipo, Asistencia,
//  Dashboard, Reportes y Mi día digan siempre lo mismo del mismo estado.
//  Los estados configurables (Comida/Diligencia/Consulta médica/Permiso/
//  Pausa) siguen tomando su color real de `jornada_states` — este catálogo
//  solo fija los estados "de sistema" que antes se escribían distinto en
//  cada pantalla (Trabajando/En curso/Presente, Jornada terminada/Fuera de
//  horario, etc.).
// ══════════════════════════════════════════════════════════

export const WORK_STATUS_COLOR: Record<string, string> = {
  trabajando: "var(--ok)",
  vacaciones: "var(--purple)",
  incidencia: "var(--danger)",
  pausa: "var(--warn)",
  sin_iniciar: "var(--text-3)",
  no_registro_salida: "var(--danger)",
  fuera_horario: "var(--text-3)",
  jornada_terminada: "var(--text-3)",
};

export const WORK_STATUS_LABEL: Record<string, string> = {
  trabajando: "Trabajando",
  vacaciones: "Vacaciones",
  incidencia: "Incidencia",
  pausa: "Pausa",
  sin_iniciar: "Sin iniciar",
  no_registro_salida: "No registró salida",
  fuera_horario: "Fuera de horario",
  jornada_terminada: "Jornada terminada",
};

/** Slug estable a partir del nombre configurable de un jornada_state (p.ej. "Consulta médica" → "consulta_médica"). */
function slugOf(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "_");
}

export interface PresenceStatus {
  key: string;
  label: string;
  color: string;
  /** Presente solo cuando key === "vacaciones" — para mostrar el rango en la tarjeta. */
  vacationRange?: { start: string; end: string } | null;
}

export interface PresenceInput {
  /** Primer "Entrada" registrada hoy, o null si nunca fichó. */
  firstIn: string | null;
  /** true mientras no exista "Fin de jornada" hoy. */
  isOpen: boolean;
  /** Calculado por summarizeDay(): entrada sin salida + horario terminado + tolerancia vencida. */
  noRegistroSalida: boolean;
  /** Nombre del estado vigente ahora mismo (de currentState()); null si la jornada ya cerró o nunca inició. */
  liveStateName?: string | null;
  liveStateColor?: string | null;
  /** true si la persona tiene vacaciones aprobadas que cubren la fecha en cuestión. */
  onVacationToday?: boolean;
  vacationRange?: { start: string; end: string } | null;
  /** true si tiene una incidencia (permiso/incapacidad/etc.) aprobada que cubre hoy y no ha fichado. */
  onApprovedIncidentToday?: boolean;
  /** true si nunca fichó Y ya pasó toda su ventana de horario (fin + tolerancia). */
  scheduleEndPassedWithoutEntry?: boolean;
}

/**
 * Única función de resolución de presencia — Equipo, Asistencia, Dashboard,
 * Reportes y Mi día deben pasar por aquí en vez de inventar su propio texto.
 * Prioridad: Vacaciones > Incidencia > No registró salida > estado en vivo
 * (Trabajando/Comida/...) > Fuera de horario / Sin iniciar > Jornada terminada.
 */
export function resolvePresence(input: PresenceInput): PresenceStatus {
  if (input.onVacationToday) {
    return { key: "vacaciones", label: WORK_STATUS_LABEL.vacaciones, color: WORK_STATUS_COLOR.vacaciones, vacationRange: input.vacationRange ?? null };
  }
  if (input.onApprovedIncidentToday && !input.firstIn) {
    return { key: "incidencia", label: WORK_STATUS_LABEL.incidencia, color: WORK_STATUS_COLOR.incidencia };
  }
  if (input.noRegistroSalida) {
    return { key: "no_registro_salida", label: WORK_STATUS_LABEL.no_registro_salida, color: WORK_STATUS_COLOR.no_registro_salida };
  }
  if (input.isOpen && input.firstIn) {
    const name = input.liveStateName ?? "Trabajando";
    const isBaseline = name === "Trabajando";
    return {
      key: isBaseline ? "trabajando" : slugOf(name),
      label: name,
      color: input.liveStateColor ?? (isBaseline ? WORK_STATUS_COLOR.trabajando : WORK_STATUS_COLOR.pausa),
    };
  }
  if (!input.firstIn) {
    return input.scheduleEndPassedWithoutEntry
      ? { key: "fuera_horario", label: WORK_STATUS_LABEL.fuera_horario, color: WORK_STATUS_COLOR.fuera_horario }
      : { key: "sin_iniciar", label: WORK_STATUS_LABEL.sin_iniciar, color: WORK_STATUS_COLOR.sin_iniciar };
  }
  return { key: "jornada_terminada", label: WORK_STATUS_LABEL.jornada_terminada, color: WORK_STATUS_COLOR.jornada_terminada };
}
