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
  nexus_clave: string | null;
  nexus_color: string | null;
  specialties: string[];
  area: string | null;
  area_id: string | null;
  active: boolean;
  vacation_balance: number;
  onboarded: boolean;
  departments?: { id: string; nombre: string; tipo: "coordinacion" | "departamento" } | null;
}

export interface Department {
  id: string;
  nombre: string;
  tipo: "coordinacion" | "departamento";
  activo: boolean;
}

export interface Schedule {
  id: string;
  user_id: string;
  start_time: string;   // "09:00:00"
  end_time: string;
  target_min: number;   // 480 / 420
  tolerance_min: number;
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
  created_at: string;
  users?: { full_name: string; display_name: string; nexus_color: string | null };
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

export type RequestType = "cobertura" | "diseno" | "lona" | "video" | "difusion";
export type RequestStatus = "solicitada" | "aprobada" | "en_progreso" | "en_revision" | "completada" | "pausada" | "cancelada";
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
  users?: { full_name: string; title: string | null };
}

export const TYPE_LABELS: Record<RequestType, string> = {
  cobertura: "Cobertura", diseno: "Diseño", lona: "Lona", video: "Video", difusion: "Difusión",
};

export const MIN_HOURS: Record<RequestType, number> = {
  cobertura: 72, diseno: 72, difusion: 72, lona: 168, video: 168,
};

export const STATUS_LABELS: Record<RequestStatus, string> = {
  solicitada: "Solicitada", aprobada: "Aprobada", en_progreso: "En progreso",
  en_revision: "En revisión", completada: "Completada", pausada: "Pausada", cancelada: "Cancelada",
};
