// ══════════════════════════════════════════════════════════
//  EMET · Attendance Domain — única fuente de verdad para
//  "¿por qué esta persona no inició su jornada?" en toda la app
//  (Asistencia, Equipo, Directorio, Hoy, Mi día, Reportes).
//
//  Vive en src/lib/domain/ porque es el primer módulo de lo que
//  será el dominio de asistencia de EMET — a medida que crezcan
//  las reglas de negocio (turnos rotativos, guardias, licencias…)
//  este archivo se separa cuando una pieza concreta lo justifique
//  (ver docs/superpowers/specs/2026-07-31-attendance-status-resolver-design.md
//  y la conversación de arquitectura del mismo día), no antes —
//  dividir en 8 archivos de 20 líneas hoy solo cambiaría "dónde
//  busco esto" por otro "dónde busco esto".
// ══════════════════════════════════════════════════════════

export type IncidentKind =
  | "permiso" | "incapacidad" | "home_office"
  | "comision" | "falta_justificada" | "cambio_jornada";

export type AttendanceStatusKey =
  | "trabajando" | "pausa"
  | "vacaciones" | "incapacidad" | "permiso" | "comision" | "home_office"
  | "falta_justificada" | "dia_inhabil" | "descanso" | "evento_externo"
  | "falta_injustificada" | "sin_iniciar"
  | "no_registro_salida" | "pendiente_confirmar_salida" | "jornada_terminada"
  | "fuera_horario";

export type BadgeVariant = "ok" | "warn" | "danger" | "accent" | "purple" | "muted";

/** Campos que decide cada rama del resolver. */
interface CoreStatus {
  key: AttendanceStatusKey;
  label: string;
  color: string;          // var(--token) — SIEMPRE de aquí
  icon: string;            // nombre para <Icon name=.../>
  badgeVariant: BadgeVariant;
  reportLabel: string;     // "VACACIONES" — para reporte semanal/Excel
  priority: number;
  reason?: string;
}

/** Campos derivados de `key`, calculados una sola vez en `finalize()` — así
    el resto de EMET deja de escribir `if (status.key === "sin_iniciar")` en
    cada pantalla y en su lugar pregunta `status.showInDirectory`,
    `status.canCheckIn`, etc. Deliberadamente NO incluye `actions` (callbacks
    tipo openVacation/approveIncident): eso acoplaría este resolver puro a
    React/mutaciones — esa decisión la sigue tomando el componente, a partir
    de `key`. Tampoco incluye showInCalendar/showInTimeline/calendarColor:
    EMET todavía no tiene un calendario de eventos de asistencia real: se
    agregan cuando ese calendario exista, no antes. */
export interface AttendanceStatus extends CoreStatus {
  /** Igual a `label` hoy — separado para que la UI pueda pedir "title" sin
      acoplarse al nombre interno, si más adelante título y label divergen. */
  title: string;
  /** Detalle largo para tooltips (rango de vacaciones, nota de incidencia/
      descanso) — alias de `reason`. */
  description?: string;
  /** Puede iniciar jornada hoy (fichar entrada). */
  canCheckIn: boolean;
  /** Puede cerrar jornada/pausa hoy (fichar salida). */
  canCheckOut: boolean;
  /** Vale la pena mostrar este estado en Directorio/Equipo — oculta los
      estados "todavía no pasó nada" (sin_iniciar, fuera_horario,
      jornada_terminada) donde antes cada pantalla tenía su propio
      if (key === …) para caer de vuelta a "Activo". */
  showInDirectory: boolean;
  /** Vale la pena escribir este estado como motivo de ausencia en el
      reporte semanal/Excel — oculta "sin_iniciar"/"fuera_horario" (no son
      un motivo, son "todavía no pasa nada"). */
  showInReports: boolean;
}

const TOKEN: Record<BadgeVariant, string> = {
  ok: "var(--ok)", warn: "var(--warn)", danger: "var(--danger)",
  accent: "var(--accent)", purple: "var(--purple)", muted: "var(--text-3)",
};

/** Únicas dos llaves donde tiene sentido fichar hoy: no ha pasado nada aún. */
const CAN_CHECK_IN: ReadonlySet<AttendanceStatusKey> = new Set(["sin_iniciar", "fuera_horario"]);
/** Jornada abierta — puede fichar salida o pausa. */
const CAN_CHECK_OUT: ReadonlySet<AttendanceStatusKey> = new Set(["trabajando", "pausa"]);
/** No aportan nada en Directorio/Equipo — la pantalla cae a "Activo". */
const HIDE_IN_DIRECTORY: ReadonlySet<AttendanceStatusKey> = new Set(["sin_iniciar", "jornada_terminada", "fuera_horario"]);
/** No son un motivo de ausencia explicable — la columna de reporte queda vacía. */
const HIDE_IN_REPORTS: ReadonlySet<AttendanceStatusKey> = new Set(["sin_iniciar", "fuera_horario"]);

function finalize(core: CoreStatus): AttendanceStatus {
  return {
    ...core,
    title: core.label,
    description: core.reason,
    canCheckIn: CAN_CHECK_IN.has(core.key),
    canCheckOut: CAN_CHECK_OUT.has(core.key),
    showInDirectory: !HIDE_IN_DIRECTORY.has(core.key),
    showInReports: !HIDE_IN_REPORTS.has(core.key),
  };
}

type AdminEventKind =
  | "vacaciones" | "incapacidad" | "permiso" | "comision" | "home_office"
  | "falta_justificada" | "dia_inhabil" | "descanso";

const ADMIN_EVENT: Record<AdminEventKind, { label: string; icon: string; badgeVariant: BadgeVariant; priority: number }> = {
  vacaciones:         { label: "Vacaciones",         icon: "plane",    badgeVariant: "purple", priority: 90 },
  incapacidad:        { label: "Incapacidad",         icon: "medical",  badgeVariant: "danger",  priority: 85 },
  permiso:            { label: "Permiso",             icon: "flag",     badgeVariant: "warn",    priority: 80 },
  comision:           { label: "Comisión",            icon: "walk",     badgeVariant: "accent",  priority: 75 },
  home_office:        { label: "Home office",         icon: "building", badgeVariant: "accent",  priority: 70 },
  falta_justificada:  { label: "Falta justificada",   icon: "info",     badgeVariant: "warn",    priority: 65 },
  dia_inhabil:        { label: "Día inhábil",          icon: "calendar", badgeVariant: "muted",   priority: 60 },
  descanso:           { label: "Descanso",             icon: "moon",     badgeVariant: "accent",  priority: 55 },
};

const INCIDENT_KIND_TO_EVENT: Partial<Record<IncidentKind, AdminEventKind>> = {
  permiso: "permiso", incapacidad: "incapacidad", home_office: "home_office",
  comision: "comision", falta_justificada: "falta_justificada",
  // cambio_jornada: excluido a propósito — no es ausencia que explicar.
};

function eventStatus(kind: AdminEventKind, reason?: string): CoreStatus {
  const e = ADMIN_EVENT[kind];
  return {
    key: kind as AttendanceStatusKey, label: e.label, icon: e.icon,
    badgeVariant: e.badgeVariant, color: TOKEN[e.badgeVariant],
    reportLabel: e.label.toUpperCase(), priority: e.priority, reason,
  };
}

export interface ResolveInput {
  date: string;
  today: string;
  firstIn: string | null;
  isOpen: boolean;
  noRegistroSalida: boolean;
  pendingExitConfirmation?: boolean;
  liveStateName?: string | null;
  liveStateColor?: string | null;
  vacation?: { start: string; end: string } | null;
  incident?: { kind: IncidentKind; note?: string | null } | null;
  isHoliday?: boolean;
  restDay?: { note?: string | null } | null;
  /** FASE 8 (auditoría 4 ago 2026): la persona está confirmada como
      participante de un evento institucional confirmado que cae en `date`
      — antes nada cruzaba "¿tiene evento asignado hoy?" contra el estado
      de asistencia; el sistema de eventos vivía completamente aparte. */
  externalEvent?: { title: string } | null;
  isBusinessDay: boolean;
  scheduleEndPassedWithoutEntry?: boolean;
}

/** Única función de resolución de estado de asistencia — ver spec para la
    tabla de prioridad completa. Pura: no hace I/O, el caller ya trae los
    catálogos filtrados a `date`. */
export function getAttendanceStatus(input: ResolveInput): AttendanceStatus {
  // 1) Jornada activa — comportamiento idéntico al resolver anterior.
  if (input.noRegistroSalida) {
    return finalize({ key: "no_registro_salida", label: "No registró salida", icon: "alert", badgeVariant: "danger", color: TOKEN.danger, reportLabel: "NO REGISTRÓ SALIDA", priority: 100 });
  }
  if (input.pendingExitConfirmation) {
    return finalize({ key: "pendiente_confirmar_salida", label: "Pendiente de confirmar salida", icon: "clock", badgeVariant: "warn", color: TOKEN.warn, reportLabel: "PENDIENTE CONFIRMAR SALIDA", priority: 99 });
  }
  if (input.isOpen && input.firstIn) {
    const name = input.liveStateName ?? "Trabajando";
    const isBaseline = name === "Trabajando";
    return finalize({
      key: isBaseline ? "trabajando" : "pausa", label: name, icon: isBaseline ? "walk" : "pause",
      badgeVariant: isBaseline ? "ok" : "warn",
      color: input.liveStateColor ?? TOKEN[isBaseline ? "ok" : "warn"],
      reportLabel: name.toUpperCase(), priority: 98,
    });
  }

  // 2) Eventos administrativos — orden de prioridad del spec.
  if (input.vacation) {
    return finalize(eventStatus("vacaciones", `${input.vacation.start} – ${input.vacation.end}`));
  }
  if (input.incident) {
    const eventKind = INCIDENT_KIND_TO_EVENT[input.incident.kind];
    if (eventKind) return finalize(eventStatus(eventKind, input.incident.note ?? undefined));
  }
  if (input.isHoliday) return finalize(eventStatus("dia_inhabil"));
  if (input.restDay) return finalize(eventStatus("descanso", input.restDay.note ?? undefined));
  // Evento externo (FASE 8): no reordena las prioridades existentes (eso es
  // decisión de producto aparte, ver FASE 11) — solo llena el hueco real:
  // antes de esto, alguien cubriendo un evento sin fichar oficina cualquier
  // día caía directo a "Falta injustificada" o "Sin iniciar".
  if (input.externalEvent) {
    return finalize({
      key: "evento_externo", label: "Evento externo", icon: "pin", badgeVariant: "accent",
      color: TOKEN.accent, reportLabel: "EVENTO EXTERNO", priority: 68, reason: input.externalEvent.title,
    });
  }

  // 3) Sin jornada y sin evento administrativo.
  if (!input.firstIn) {
    const isToday = input.date === input.today;
    if (!isToday && input.isBusinessDay && input.date < input.today) {
      return finalize({ key: "falta_injustificada", label: "Falta injustificada", icon: "alert", badgeVariant: "danger", color: TOKEN.danger, reportLabel: "FALTA INJUSTIFICADA", priority: 10 });
    }
    if (isToday && input.scheduleEndPassedWithoutEntry) {
      return finalize({ key: "fuera_horario", label: "Fuera de horario", icon: "clock", badgeVariant: "muted", color: TOKEN.muted, reportLabel: "FUERA DE HORARIO", priority: 5 });
    }
    return finalize({ key: "sin_iniciar", label: "Sin iniciar", icon: "clock", badgeVariant: "muted", color: TOKEN.muted, reportLabel: "SIN INICIAR", priority: 0 });
  }

  return finalize({ key: "jornada_terminada", label: "Jornada terminada", icon: "check", badgeVariant: "muted", color: TOKEN.muted, reportLabel: "JORNADA TERMINADA", priority: 50 });
}
