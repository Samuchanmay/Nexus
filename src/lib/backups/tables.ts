// ══════════════════════════════════════════════════════════════════
//  EMET · Backups — catálogo único de tablas respaldables (FASE W8.1)
//  ══════════════════════════════════════════════════════════════════
//  Única fuente de verdad de qué tablas entran en un respaldo y cuál es
//  su llave primaria (para el upsert de restauración). Se consulta
//  tanto al crear un respaldo como al restaurarlo — nunca se acepta un
//  nombre de tabla que no esté aquí, ni del cliente ni del contenido de
//  un JSON de respaldo viejo.
//
//  Criterio de inclusión: datos operativos del negocio (asistencia,
//  vacaciones, incidencias, eventos, proyectos, catálogos de
//  configuración). Quedan FUERA a propósito:
//   - Chat (conversations/messages/...): privacidad + ya vive en
//     Realtime, no es el tipo de dato que un respaldo de "operación"
//     debe mover.
//   - Demos/onboarding: material de marketing, no dato operativo.
//   - Cualquier tabla con secretos o tokens (google_oauth_tokens,
//     mfa_recovery_codes, push_subscriptions, known_devices): un
//     respaldo JAMÁS debe poder filtrar credenciales, ni por accidente.
//   - user_heartbeats, notifications, logs de integración: efímeros,
//     sin valor de restauración.
// ══════════════════════════════════════════════════════════════════

/** Llave primaria de cada tabla — "id" por default salvo las excepciones listadas. */
const PK_OVERRIDES: Record<string, string> = {
  activity_types: "key",
  app_settings: "key",
};

export const BACKUP_TABLES = [
  "users",
  "departments",
  "schedules",
  "attendance",
  "attendance_corrections",
  "vacations",
  "vacation_resets",
  "incidents",
  "holidays",
  "rest_days",
  "requests",
  "institutional_events",
  "event_participants",
  "event_attendance",
  "event_history",
  "app_settings",
  "catalog_items",
  "activity_types",
  "jornada_states",
  "gps_zones",
  "projects",
  "project_assignments",
  "project_dependencies",
  "checklist_templates",
  "checklist_items",
  "project_checklist",
  "task_time_logs",
  "time_edit_requests",
  "evidences",
  "comments",
  "employee_availability",
  "guards",
  "pending_exits",
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number];

export function isBackupTable(name: string): name is BackupTable {
  return (BACKUP_TABLES as readonly string[]).includes(name);
}

export function primaryKeyOf(table: BackupTable): string {
  return PK_OVERRIDES[table] ?? "id";
}

/** Etiqueta legible para la UI de admin. */
export const TABLE_LABEL: Record<BackupTable, string> = {
  users: "Usuarios",
  departments: "Coordinaciones/departamentos",
  schedules: "Horarios",
  attendance: "Asistencia",
  attendance_corrections: "Correcciones de asistencia",
  vacations: "Vacaciones",
  vacation_resets: "Reinicios de vacaciones",
  incidents: "Incidencias",
  holidays: "Días inhábiles",
  rest_days: "Días de descanso",
  requests: "Solicitudes",
  institutional_events: "Eventos institucionales",
  event_participants: "Participantes de eventos",
  event_attendance: "Asistencia a eventos",
  event_history: "Historial de eventos",
  app_settings: "Configuración de la app",
  catalog_items: "Catálogos",
  activity_types: "Tipos de actividad",
  jornada_states: "Estados de jornada",
  gps_zones: "Zonas GPS",
  projects: "Proyectos",
  project_assignments: "Asignaciones de proyecto",
  project_dependencies: "Dependencias de proyecto",
  checklist_templates: "Plantillas de checklist",
  checklist_items: "Ítems de checklist",
  project_checklist: "Checklist de proyecto",
  task_time_logs: "Bitácora de tiempo",
  time_edit_requests: "Solicitudes de edición de tiempo",
  evidences: "Evidencias",
  comments: "Comentarios",
  employee_availability: "Disponibilidad de empleados",
  guards: "Guardias",
  pending_exits: "Salidas pendientes",
};
