// ═══════════════════════════════════════════════════════════════
//  C2 · gcal — enlaces de un clic a Google Calendar (v1, sin API)
//  F2 los sustituirá por la Edge Function `gcal-sync`; esto queda
//  como fallback documentado en el ROADMAP.
// ═══════════════════════════════════════════════════════════════
import { addDays } from "./tz";
import type { CommRequest, Vacation } from "./types";

const BASE = "https://calendar.google.com/calendar/render?action=TEMPLATE";

/** Evento de día completo para unas vacaciones aprobadas (fin exclusivo: +1 día). */
export function vacationCalendarUrl(v: Pick<Vacation, "start_date" | "end_date" | "days"> & {
  users?: { display_name: string } | null;
}) {
  const compact = (d: string) => d.replaceAll("-", "");
  const endStr = addDays(v.end_date, 1).replaceAll("-", ""); // fin exclusivo, sin efectos de zona
  const title = encodeURIComponent(`🌴 Vacaciones — ${v.users?.display_name ?? ""}`);
  const details = encodeURIComponent(`${v.days} días hábiles aprobados en Nexus.`);
  return `${BASE}&text=${title}&dates=${compact(v.start_date)}/${endStr}&details=${details}`;
}

/** Evento (1 h) para el proyecto de una solicitud aprobada con fecha. */
export function requestCalendarUrl(
  r: Pick<CommRequest, "type" | "title" | "notes" | "event_date" | "event_time" | "event_location">,
  typeLabel: Record<string, string>,
) {
  const d = (r.event_date ?? "").replaceAll("-", "");
  const t = (r.event_time ?? "09:00:00").replaceAll(":", "").slice(0, 6);
  const endT = String(Number(t.slice(0, 2)) + 1).padStart(2, "0") + t.slice(2);
  const title = encodeURIComponent(`${typeLabel[r.type] ?? r.type} — ${r.title}`);
  const details = encodeURIComponent(`Proyecto Nexus · ${r.notes ?? ""}`);
  const loc = encodeURIComponent(r.event_location ?? "");
  return `${BASE}&text=${title}&dates=${d}T${t}/${d}T${endT}&details=${details}&location=${loc}`;
}
