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
  /** Silencio por duración (FASE "plataforma de mensajería moderna"):
      si está en el futuro, la conversación está silenciada hasta esa
      fecha; null = silencio indefinido (lo cubre `muted`) o sin silencio. */
  muted_until?: string | null;
  /** Fijado/archivado por usuario — cada participante tiene su propio
      estado, no es una propiedad de la conversación (ver migración
      chat_signal_style_foundations). */
  pinned: boolean;
  archived: boolean;
  last_read_at: string;
  users?: { id: string; display_name: string; avatar_url: string | null; nexus_color: string | null } | null;
}

export type EnlaceMessageType = "text" | "image" | "file" | "system" | "location" | "sticker" | "poll";
export type EnlaceMessageStatus = "pending" | "sent" | "delivered" | "read" | "failed";

export interface EnlaceMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  type: EnlaceMessageType;
  content: string | null;
  reply_to_id: string | null;
  edited: boolean;
  /** Borrado suave (FASE 2) — la fila vive con content = null y la UI
      muestra "Mensaje eliminado". Las consultas ya la excluyen vía
      `.is("deleted_at", null)`; el flag llega por realtime para que el
      resto de participantes vea el cambio en vivo. */
  deleted_at: string | null;
  /** Coordenadas del mensaje de tipo `location` (0022). */
  lat?: number | null;
  lng?: number | null;
  created_at: string;
  status: EnlaceMessageStatus;
  /** Cuándo un destinatario abrió la conversación viendo este mensaje
      (lecturas con hora — migración 0025). El tick "✓✓ Leído · HH:MM" de
      las burbujas propias lo usa cuando status === "read". */
  read_at?: string | null;
  /** Solo existe en el cliente antes de que el insert confirme — se manda
      como columna `client_id` para que el outbox pueda reconciliar sin
      duplicar si un reintento sí había llegado la primera vez. */
  client_id?: string | null;
  /** FASE W7 — cuántas respuestas tiene este mensaje (trigger en BD,
      migración 0045). Solo tiene sentido en el mensaje raíz de un hilo. */
  reply_count?: number;
  /** FASE W7 — sticker con imagen generada por IA (migración 0046). Si es
      null/undefined en un mensaje type="sticker", el contenido sigue
      siendo el emoji clásico (compatibilidad con lo ya enviado). */
  sticker_image_path?: string | null;
}

/** FASE W7 — Encuesta colgada de un mensaje (type="poll"). */
export interface ChatPoll {
  id: string;
  message_id: string;
  conversation_id: string;
  creator_id: string;
  question: string;
  multiple_choice: boolean;
  created_at: string;
}

export interface ChatPollOption {
  id: string;
  poll_id: string;
  label: string;
  position: number;
}

export interface ChatPollVote {
  id: string;
  poll_id: string;
  option_id: string;
  user_id: string;
  created_at: string;
}

/** Encuesta completa con sus opciones y votos — lo que el cliente arma para
    renderizar (mismo criterio que attachmentsByMessage/reactionsByMessage:
    un mapa aparte keyed por message_id, no todo embebido en EnlaceMessage). */
export interface ChatPollFull {
  poll: ChatPoll;
  options: ChatPollOption[];
  votes: ChatPollVote[];
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
  /** Pipeline de imagen (0023): variantes WebP generadas en el cliente.
      NULL en adjuntos antiguos o no-imagen — el render cae a `file_path`. */
  thumb_path?: string | null;
  thumb_size?: number | null;
  thumb_mime?: string | null;
  medium_path?: string | null;
  medium_size?: number | null;
  medium_mime?: string | null;
}

/** FASE W8 — Bandeja interna de soporte (migración 0048). Alcance simple:
    sin SLA, sin hilo de comentarios — un campo de respuesta del admin. */
export type SupportTicketCategory = "tecnico" | "asistencia" | "nomina_rh" | "equipo_chat" | "cuenta" | "otro";
export type SupportTicketStatus = "abierto" | "en_progreso" | "resuelto";

export interface SupportTicket {
  id: string;
  user_id: string;
  category: SupportTicketCategory;
  title: string;
  description: string;
  status: SupportTicketStatus;
  admin_id: string | null;
  admin_response: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export const SUPPORT_CATEGORY_LABEL: Record<SupportTicketCategory, string> = {
  tecnico: "Problema técnico", asistencia: "Asistencia", nomina_rh: "Nómina / RH",
  equipo_chat: "Equipo / Chat", cuenta: "Mi cuenta", otro: "Otro",
};

export const SUPPORT_STATUS_LABEL: Record<SupportTicketStatus, string> = {
  abierto: "Abierto", en_progreso: "En progreso", resuelto: "Resuelto",
};
