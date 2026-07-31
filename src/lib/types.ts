// ── NEXUS · Tipos del dominio ──
export type Role = "admin" | "empleado" | "rh" | "coordinador" | "departamento";

export interface UserProfile {
  id: string;
  auth_id: string | null;
  email: string;
  full_name: string;
  display_name: string;
  avatar_url: string | null;
  role: Role;
  requester_kind: "coordinador" | "departamento" | null;
  title: string | null;
  honorific: string | null;
  phone: string | null;
  extension: string | null;
  nexus_clave: string | null;
  nexus_color: string | null;
  specialties: string[];
  area: string | null;
  area_id: string | null;
  active: boolean;
  vacation_balance: number;
  vacation_days_per_year: number;
  hire_date: string | null;
  birth_date: string | null;
  onboarded: boolean;
  nivel: "licenciatura" | "centro_educativo" | "posgrado" | null;
  departments?: { id: string; nombre: string; tipo: "coordinacion" | "departamento" } | null;
}

export interface Department {
  id: string;
  nombre: string;
  tipo: "coordinacion" | "departamento";
  activo: boolean;
  color: string | null;
}

export interface GpsZone {
  id: string;
  nombre: string;
  lat: number;
  lng: number;
  radio_m: number;
  activo: boolean;
}

export interface Schedule {
  id: string;
  user_id: string;
  start_time: string;   // "09:00:00"
  end_time: string;
  target_min: number;   // 480 / 420
  tolerance_min: number;
  valid_from: string;    // "aaaa-mm-dd" — desde cuándo aplica
  valid_until: string | null; // null = horario permanente vigente
  work_days?: string;
}

export type AttendanceReason =
  | "Entrada a trabajo" | "Regreso de comida" | "Regreso de diligencia"
  | "Regreso de cita médica" | "Regreso de permiso" | "Regreso de pendientes"
  | "Salida a comer" | "Salida a pendientes" | "Salida a diligencia"
  | "Salida a permiso" | "Salida a cita médica" | "Fin de jornada";

export interface AttendanceRow {
  id: string;
  user_id: string;
  type: "Entrada" | "Salida";
  reason: AttendanceReason;
  date: string;
  time: string;
  distance_m: number | null;
}

export interface Vacation {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  days: number;
  status: "Pendiente" | "Aprobada" | "Rechazada" | "Cancelada";
  admin_note: string | null;
  calendar_event_id: string | null;
  calendar_id?: string | null;
  created_at: string;
  users?: { full_name: string; display_name: string; nexus_color: string | null; avatar_url?: string | null; birth_date?: string | null };
}

export interface Incident {
  id: string;
  user_id: string;
  kind: "permiso" | "incapacidad" | "home_office" | "comision" | "falta_justificada" | "cambio_jornada";
  start_date: string;
  end_date: string;
  note: string | null;
  status: "Pendiente" | "Autorizado" | "Rechazado";
  users?: { full_name: string; display_name: string };
}

// Los tipos de actividad ya NO están fijos aquí — viven en la tabla
// activity_types (editable desde Configuración → Tipos de Actividad,
// Plano Maestro §13) y se validan con una foreign key en la base de datos.
export type RequestType = string;
export type RequestStatus = "solicitada" | "aprobada" | "en_progreso" | "en_revision" | "completada" | "pausada" | "cancelada";

export interface ActivityType {
  key: string;
  label: string;
  min_hours: number;
  icon: string;
  subtypes: string[];
  orden: number;
  activo: boolean;
}
export type Priority = "baja" | "normal" | "alta" | "urgente";

export interface CommRequest {
  id: string;
  requester_id: string | null;
  requester_type: "coordinador" | "departamento" | "externo";
  requester_name: string | null;
  type: RequestType;
  subtype: string[];
  title: string;
  event_date: string | null;
  event_time: string | null;
  event_location: string | null;
  notes: string | null;
  status: RequestStatus;
  priority: Priority;
  rejection_reason: string | null;
  min_hours_required: number;
  created_at: string;
  users?: { full_name: string; title: string | null; honorific: string | null };
}

/** Construye {clave: etiqueta} a partir del catálogo real (activity_types). */
export function typeLabels(types: ActivityType[]): Record<string, string> {
  return Object.fromEntries(types.map((t) => [t.key, t.label]));
}

/** Construye {clave: horas mínimas de anticipación} a partir del catálogo real. */
export function typeMinHours(types: ActivityType[]): Record<string, number> {
  return Object.fromEntries(types.map((t) => [t.key, t.min_hours]));
}

export const STATUS_LABELS: Record<RequestStatus, string> = {
  solicitada: "Solicitada", aprobada: "Aprobada", en_progreso: "En progreso",
  en_revision: "En revisión", completada: "Completada", pausada: "Pausada", cancelada: "Cancelada",
};

// ── Enlace (mensajería interna, FASE W6 ronda 1) ──
// Adaptado de EQUIPO-ARCHITECTURE.md — ver comentario de la migración
// 0011_enlace_mvp.sql para el detalle de qué se dejó fuera de esta ronda.
export type EnlaceConversationType = "direct" | "group" | "announcement";

export interface EnlaceConversation {
  id: string;
  type: EnlaceConversationType;
  name: string | null;
  avatar_url: string | null;
  created_by: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  last_message_sender_id: string | null;
  created_at: string;
  pinned_message_id: string | null;
  pinned_by: string | null;
  pinned_at: string | null;
}

export interface EnlaceParticipant {
  id: string;
  conversation_id: string;
  user_id: string;
  role: "admin" | "member";
  joined_at: string;
  muted: boolean;
  /** Fijado/archivado por usuario — cada participante tiene su propio
      estado, no es una propiedad de la conversación (ver migración
      chat_signal_style_foundations). */
  pinned: boolean;
  archived: boolean;
  last_read_at: string;
  users?: { id: string; display_name: string; avatar_url: string | null; nexus_color: string | null } | null;
}

export type EnlaceMessageType = "text" | "image" | "file" | "system";
export type EnlaceMessageStatus = "pending" | "sent" | "delivered" | "read" | "failed";

export interface EnlaceMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  type: EnlaceMessageType;
  content: string | null;
  reply_to_id: string | null;
  edited: boolean;
  created_at: string;
  status: EnlaceMessageStatus;
  /** Solo existe en el cliente antes de que el insert confirme — se manda
      como columna `client_id` para que el outbox pueda reconciliar sin
      duplicar si un reintento sí había llegado la primera vez. */
  client_id?: string | null;
}

export interface EnlaceReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

// Un adjunto por mensaje (MVP — no multi-adjunto por mensaje todavía).
export interface EnlaceAttachment {
  id: string;
  message_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}
