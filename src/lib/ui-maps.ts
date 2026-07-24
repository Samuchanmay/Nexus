// ═══════════════════════════════════════════════════════════════
//  C1 · ui-maps — fuente ÚNICA de mapas estado/prioridad → tono/etiqueta
//  (antes duplicados en 8 archivos client; ver AUDIT §4)
// ═══════════════════════════════════════════════════════════════
import type { Incident, Priority, RequestStatus, Vacation } from "./types";

/** Tono visual por estado de solicitud/proyecto (usado por <Pill/>).
 * El azul (accent) se reserva solo para "en_progreso" — el único estado
 * realmente activo. "Aprobada" ya no compite por el mismo azul: es un
 * estado neutro (aprobado pero no necesariamente en marcha todavía). */
export const STATUS_TONE: Record<RequestStatus, "warn" | "accent" | "ok" | "danger" | "muted"> = {
  solicitada: "warn", aprobada: "muted", en_progreso: "accent",
  en_revision: "warn", completada: "ok", pausada: "muted", cancelada: "danger",
};

/** "Normal" ya no es azul — es la prioridad por defecto, no algo que deba
 * competir visualmente. El azul se reserva para acciones/estados que sí
 * importan; alta/urgente siguen con warn/danger. */
export const PRIORITY_TONE: Record<Priority, "muted" | "accent" | "warn" | "danger"> = {
  baja: "muted", normal: "muted", alta: "warn", urgente: "danger",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  baja: "Baja", normal: "Normal", alta: "Alta", urgente: "Urgente",
};

export const VACATION_TONE: Record<Vacation["status"], "warn" | "ok" | "danger" | "muted"> = {
  Pendiente: "warn", Aprobada: "ok", Rechazada: "danger", Cancelada: "muted",
};

export const INCIDENT_TONE: Record<Incident["status"], "warn" | "ok" | "danger"> = {
  Pendiente: "warn", Autorizado: "ok", Rechazado: "danger",
};

export const KIND_LABELS: Record<Incident["kind"], string> = {
  permiso: "Permiso", incapacidad: "Incapacidad", home_office: "Home office",
  comision: "Comisión", falta_justificada: "Falta justificada", cambio_jornada: "Cambio de jornada",
};
