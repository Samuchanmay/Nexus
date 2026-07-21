import { createClient } from "@/lib/supabase/server";
import { todayMerida } from "@/lib/tz";
import { shiftMonth, monthBounds } from "@/lib/calendar-grid";
import { getTodayEfemerides } from "@/lib/efemerides";
import CalendarioClient, { type TeamMember, type ProjectDeadline, type VacationRange } from "./client";

/* ═══════════════════════════════════════════════════════════════
   L5 · Calendario del equipo — tres vistas (Asistencia / Actividades
   / Vacaciones) sobre el mismo mes, con días inhábiles como contexto
   compartido. La vista de Asistencia es el heatmap heredado de
   cert_nexus; Actividades y Vacaciones son nuevas.
   ═══════════════════════════════════════════════════════════════ */

export default async function Calendario({ searchParams }: { searchParams: Promise<{ m?: string; d?: string }> }) {
  const { m, d } = await searchParams;
  const today = todayMerida();
  const ym = /^\d{4}-\d{2}$/.test(m ?? "") ? m! : today.slice(0, 7);
  const initialFocusDate = /^\d{4}-\d{2}-\d{2}$/.test(d ?? "") && (d as string).slice(0, 7) === ym ? d! : undefined;
  const { year, month, daysInMonth, first, last } = monthBounds(ym);

  const supabase = await createClient();
  const [{ data: team }, { data: att }, { data: vacs }, { data: hols }, { data: projects }, { data: efemSetting }, { data: activitySetting }] = await Promise.all([
    supabase.from("users").select("id, display_name, nexus_color, avatar_url").eq("active", true).in("role", ["admin", "empleado"]).order("display_name"),
    supabase.from("attendance").select("user_id, date").gte("date", first).lte("date", last),
    supabase.from("vacations").select("user_id, start_date, end_date").eq("status", "Aprobada").is("archived_at", null).lte("start_date", last).gte("end_date", first),
    supabase.from("holidays").select("date, name").gte("date", first).lte("date", last),
    supabase.from("projects")
      .select("id, deadline, status, requests(title, type), project_assignments(is_lead, users(display_name, nexus_color))")
      .not("deadline", "is", null).gte("deadline", first).lte("deadline", last).order("deadline"),
    supabase.from("app_settings").select("value").eq("key", "gcal_efemerides_calendar_id").maybeSingle(),
    supabase.from("app_settings").select("value").eq("key", "gcal_activity_calendar_id").maybeSingle(),
  ]);

  const efemerides = efemSetting?.value ? await getTodayEfemerides(efemSetting.value) : [];

  // Eventos externos ya agendados en el calendario "Eventos CERT" (Google) —
  // incluye eventos creados directamente en Google, no solo los de Nexus.
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
          timeMin: `${first}T00:00:00-06:00`,
          timeMax: `${last}T23:59:59-06:00`,
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
      holidays={(hols ?? []) as { date: string; name: string }[]}
      deadlines={(projects ?? []) as unknown as ProjectDeadline[]}
      efemerides={efemerides.map((e) => e.title)}
      gcalEvents={gcalEvents}
      gcalError={gcalError}
      initialFocusDate={initialFocusDate}
    />
  );
}
