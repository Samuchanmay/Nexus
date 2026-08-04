import { createClient } from "@/lib/supabase/server";
import { todayMerida } from "@/lib/tz";
import { shiftMonth, monthBounds } from "@/lib/calendar-grid";
import { yearRange } from "@/lib/calendar-core";
import { getTodayEfemerides } from "@/lib/efemerides";
import CalendarioClient, { type TeamMember, type ProjectDeadline, type VacationRange, type InstitutionalEvent } from "./client";

/* ═══════════════════════════════════════════════════════════════
   L5 · Calendario del equipo — tres vistas (Asistencia / Actividades
   / Vacaciones) sobre el mismo mes, con días inhábiles como contexto
   compartido. La vista de Asistencia es el heatmap heredado de
   cert; Actividades y Vacaciones son nuevas.
   ═══════════════════════════════════════════════════════════════ */

export default async function Calendario({ searchParams }: { searchParams: Promise<{ m?: string; d?: string }> }) {
  const { m, d } = await searchParams;
  const today = todayMerida();
  const ym = /^\d{4}-\d{2}$/.test(m ?? "") ? m! : today.slice(0, 7);
  const initialFocusDate = /^\d{4}-\d{2}-\d{2}$/.test(d ?? "") && (d as string).slice(0, 7) === ym ? d! : undefined;
  const { year, month, daysInMonth, first, last } = monthBounds(ym);
  // Rango de AÑO completo (EMET-CALENDAR-ENGINE.md §8.5, vista Año/heatmap):
  // el motor necesita los eventos de los 12 meses para el heatmap, no solo
  // el mes en pantalla. Asistencia sigue acotada al mes (first/last arriba)
  // porque su heatmap solo se muestra en granularidad Mes/Semana/Día.
  const { first: yFirst, last: yLast } = yearRange(year);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: team }, { data: att }, { data: vacs }, { data: hols }, { data: projects }, { data: efemSetting }, { data: activitySetting }, { data: instEvents }] = await Promise.all([
    supabase.from("users").select("id, display_name, nexus_color, avatar_url, birth_date").eq("active", true).in("role", ["admin", "empleado"]).order("display_name"),
    supabase.from("attendance").select("user_id, date").gte("date", first).lte("date", last),
    supabase.from("vacations").select("user_id, start_date, end_date").eq("status", "Aprobada").is("archived_at", null).lte("start_date", yLast).gte("end_date", yFirst),
    supabase.from("holidays").select("date, name, kind").gte("date", yFirst).lte("date", yLast),
    supabase.from("projects")
      .select("id, deadline, status, requests(title, type), project_assignments(is_lead, users(display_name, nexus_color))")
      .not("deadline", "is", null).gte("deadline", yFirst).lte("deadline", yLast).order("deadline"),
    supabase.from("app_settings").select("value").eq("key", "gcal_efemerides_calendar_id").maybeSingle(),
    supabase.from("app_settings").select("value").eq("key", "gcal_activity_calendar_id").maybeSingle(),
    // Calendarios institucionales (FASE U + Fase 1) — fusionados aquí como una capa
    // más, administrados directamente en Emet (a diferencia de "Eventos
    // CERT" que vive en Google Calendar y solo se lee vía gcal-list-events).
    supabase.from("institutional_events").select("id, title, kind, start_date, end_date, notes, start_time, end_time, client_name, department_id, location_type, location_name, location_address, location_coords, location_radius, allow_any_location, owner_id, status, priority, description")
      .lte("start_date", yLast).gte("end_date", yFirst).order("start_date"),
  ]);
  const { data: meRow } = user ? await supabase.from("users").select("id").eq("auth_id", user.id).single() : { data: null };

  const efemerides = efemSetting?.value ? await getTodayEfemerides(efemSetting.value) : [];

  // Eventos externos ya agendados en el calendario "Eventos CERT" (Google) —
  // incluye eventos creados directamente en Google, no solo los de Emet.
  // No bloquea la página si falla (calendario privado sin permiso conectado, etc.)
  // pero SÍ deja rastro visible del error — antes fallaba en silencio y no
  // había forma de saber por qué dejaban de aparecer los eventos.
  let gcalEvents: { id: string; title: string; start: string; end: string; allDay: boolean }[] = [];
  let gcalError: string | null = null;
  if (activitySetting?.value) {
    try {
      const { data, error } = await supabase.functions.invoke("gcal-list-events", {
        body: {
          calendarId: activitySetting.value,
          timeMin: `${yFirst}T00:00:00-06:00`,
          timeMax: `${yLast}T23:59:59-06:00`,
        },
      });
      if (error) {
        gcalError = "No se pudo conectar con el servidor para leer Google Calendar. Intenta recargar la página.";
      } else if (data?.ok) {
        gcalEvents = data.events ?? [];
      } else {
        gcalError = data?.error ?? "Google Calendar no devolvió eventos.";
      }
    } catch {
      gcalError = "Ocurrió un error inesperado leyendo Google Calendar. Intenta recargar la página.";
    }
  }

  return (
    <CalendarioClient
      ym={ym} year={year} month={month} daysInMonth={daysInMonth} today={today}
      prevHref={`/admin/calendario?m=${shiftMonth(ym, -1)}`}
      nextHref={`/admin/calendario?m=${shiftMonth(ym, 1)}`}
      team={(team ?? []) as TeamMember[]}
      attendance={(att ?? []) as { user_id: string; date: string }[]}
      vacations={(vacs ?? []) as VacationRange[]}
      holidays={(hols ?? []) as { date: string; name: string; kind: string }[]}
      deadlines={(projects ?? []) as unknown as ProjectDeadline[]}
      efemerides={efemerides.map((e) => e.title)}
      gcalEvents={gcalEvents}
      gcalError={gcalError}
      initialFocusDate={initialFocusDate}
      institutionalEvents={(instEvents ?? []) as InstitutionalEvent[]}
      adminId={meRow?.id ?? ""}
    />
  );
}
