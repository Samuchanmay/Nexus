// ══════════════════════════════════════════════════════════════════
//  EMET · ReportEngine — Reporte 4: Eventos por persona
//  ══════════════════════════════════════════════════════════════════
//  Una fila = una participación (persona × evento institucional). Los
//  eventos viven en `institutional_events` (migración 0028, ampliados
//  con cliente/ubicación/owner en 0028 y 0030); las participaciones en
//  `event_participants` (0029, rol responsable/participante) y la
//  cobertura real (check-in/out) en `event_attendance` (0029).
//
//  "Horas invertidas" = duración REAL de cobertura (event_attendance)
//  cuando existe; si nadie hizo check-in/out, se cae a la duración
//  programada del evento (start_time → end_time); si el evento ni
//  siquiera tiene horas definidas, la celda queda vacía (no se inventa).
//
//  Filtros combinables: persona, rol (responsable/participante), tipo de
//  evento (kind) y estado — todo se puede combinar con el DateRangeFilter
//  de la landing (mismo contrato ReportFilters de types.ts).
// ══════════════════════════════════════════════════════════════════
import type { SupabaseClient } from "@supabase/supabase-js";
import { INSTITUTIONAL_KIND_LABEL } from "@/lib/ui-maps";
import type { DateRange, ReportColumn } from "./types";

export interface EventByPersonRow {
  eventId: string;
  userId: string;
  employeeName: string;
  role: string;               // "Responsable" | "Participante"
  eventTitle: string;
  clientName: string | null;
  date: string;               // start_date
  startTime: string | null;   // "HH:MM:SS" o null
  endTime: string | null;
  eventType: string;          // kind
  eventTypeLabel: string;
  eventStatus: string;        // confirmado / pendiente / cancelado
  /** Horas invertidas (cobertura real o programada). null = sin dato. */
  hoursSpent: number | null;
}

export interface EventByPersonFilters {
  range: DateRange;
  /** Persona específica — filtra por cualquier rol. */
  employeeId?: string | null;
  /** Rol dentro del evento — combinable con employeeId. */
  role?: "responsable" | "participante" | null;
  eventType?: string | null;
  status?: string | null;
}

export interface EventByPersonSummary {
  personas: number;         // empleados distintos participando
  terminados: number;       // eventos únicos confirmados
  pendientes: number;       // eventos únicos en pendiente
  horasTotales: number;     // suma de horas invertidas (real o programada)
}

export async function fetchEventByPersonRows(
  supabase: SupabaseClient,
  filters: EventByPersonFilters,
): Promise<{ rows: EventByPersonRow[]; summary: EventByPersonSummary }> {
  let q = supabase
    .from("event_participants")
    .select("event_id, user_id, role, status, users(display_name), institutional_events!inner(id, title, kind, client_name, start_date, end_date, start_time, end_time, status)")
    .gte("institutional_events.start_date", filters.range.from)
    .lte("institutional_events.end_date", filters.range.to);
  if (filters.employeeId) q = q.eq("user_id", filters.employeeId);
  if (filters.role) q = q.eq("role", filters.role);
  if (filters.eventType) q = q.eq("institutional_events.kind", filters.eventType);
  if (filters.status) q = q.eq("institutional_events.status", filters.status);

  const { data: parts } = await q;

  type PartRow = {
    event_id: string; user_id: string; role: string;
    users: { display_name: string } | { display_name: string }[] | null;
    institutional_events: {
      id: string; title: string; kind: string; client_name: string | null;
      start_date: string; end_date: string; start_time: string | null;
      end_time: string | null; status: string;
    } | { id: string; title: string; kind: string; client_name: string | null;
      start_date: string; end_date: string; start_time: string | null;
      end_time: string | null; status: string; }[] | null;
  };

  const list = (parts ?? []) as PartRow[];

  const eventIds = [...new Set(list.map((p) => p.event_id))];
  const { data: att } = eventIds.length
    ? await supabase.from("event_attendance").select("event_id, user_id, check_in_at, check_out_at").in("event_id", eventIds)
    : { data: [] as { event_id: string; user_id: string; check_in_at: string | null; check_out_at: string | null }[] };

  const attendance = new Map<string, { check_in_at: string | null; check_out_at: string | null }>();
  for (const a of (att ?? []) as { event_id: string; user_id: string; check_in_at: string | null; check_out_at: string | null }[]) {
    attendance.set(`${a.event_id}:${a.user_id}`, { check_in_at: a.check_in_at, check_out_at: a.check_out_at });
  }

  const rows: EventByPersonRow[] = list
    .map((p) => {
      const ev = Array.isArray(p.institutional_events) ? p.institutional_events[0] : p.institutional_events;
      if (!ev) return null;
      const u = Array.isArray(p.users) ? p.users[0] : p.users;

      // Cobertura real primero; si no, duración programada del evento.
      const cov = attendance.get(`${p.event_id}:${p.user_id}`);
      let hours: number | null = null;
      if (cov?.check_in_at && cov.check_out_at) {
        hours = (new Date(cov.check_out_at).getTime() - new Date(cov.check_in_at).getTime()) / 3_600_000;
      } else if (ev.start_time && ev.end_time) {
        const [sh, sm] = ev.start_time.split(":").map(Number);
        const [eh, em] = ev.end_time.split(":").map(Number);
        const mins = (eh * 60 + em) - (sh * 60 + sm);
        if (mins > 0) hours = mins / 60;
      }

      return {
        eventId: ev.id,
        userId: p.user_id,
        employeeName: u?.display_name ?? "—",
        role: p.role === "responsable" ? "Responsable" : "Participante",
        eventTitle: ev.title,
        clientName: ev.client_name,
        date: ev.start_date,
        startTime: ev.start_time,
        endTime: ev.end_time,
        eventType: ev.kind,
        eventTypeLabel: INSTITUTIONAL_KIND_LABEL[ev.kind as keyof typeof INSTITUTIONAL_KIND_LABEL] ?? ev.kind,
        eventStatus: ev.status,
        hoursSpent: hours != null ? Math.round(hours * 100) / 100 : null,
      } satisfies EventByPersonRow;
    })
    .filter((r): r is EventByPersonRow => r !== null)
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName) || a.date.localeCompare(b.date) || a.eventTitle.localeCompare(b.eventTitle));

  const personas = new Set(rows.map((r) => r.userId)).size;
  const terminados = new Set(rows.filter((r) => r.eventStatus === "confirmado").map((r) => r.eventId)).size;
  const pendientes = new Set(rows.filter((r) => r.eventStatus === "pendiente").map((r) => r.eventId)).size;
  const horasTotales = Math.round(rows.reduce((a, r) => a + (r.hoursSpent ?? 0), 0) * 100) / 100;

  return { rows, summary: { personas, terminados, pendientes, horasTotales } };
}

export const EVENT_BY_PERSON_COLUMNS: ReportColumn<EventByPersonRow>[] = [
  { header: "Empleado", width: 24, align: "left", get: (r) => r.employeeName },
  {
    header: "Rol", width: 15, get: (r) => r.role,
    tint: (r) => (r.role === "Responsable" ? { bg: "DBEAFE", fg: "1E40AF" } : undefined),
  },
  { header: "Evento", width: 30, align: "left", get: (r) => r.eventTitle },
  { header: "Cliente", width: 22, align: "left", get: (r) => r.clientName ?? "—" },
  { header: "Fecha", width: 12, format: "date", get: (r) => r.date },
  { header: "Hora inicio", width: 12, format: "time12h", get: (r) => r.startTime },
  { header: "Hora fin", width: 12, format: "time12h", get: (r) => r.endTime },
  { header: "Tipo", width: 16, align: "left", get: (r) => r.eventTypeLabel },
  {
    header: "Estado", width: 14, get: (r) => r.eventStatus,
    tint: (r) => EVENT_STATUS_COLORS[r.eventStatus],
  },
  { header: "Horas invertidas", width: 15, format: "hours", get: (r) => r.hoursSpent },
];

const EVENT_STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  confirmado: { bg: "D1FAE5", fg: "065F46" },
  pendiente: { bg: "FEF3C7", fg: "92400E" },
  cancelado: { bg: "FEE2E2", fg: "991B1B" },
};

/** Opciones para el filtro "Estado" de la landing — misma fuente que el
 *  tint del Excel. */
export const EVENT_REPORT_STATUS_OPTIONS = Object.keys(EVENT_STATUS_COLORS)
  .map((label) => ({ value: label, label }));

/** Opciones para el filtro "Rol" de la landing. */
export const EVENT_REPORT_ROLE_OPTIONS = [
  { value: "responsable", label: "Responsable" },
  { value: "participante", label: "Participante" },
];
