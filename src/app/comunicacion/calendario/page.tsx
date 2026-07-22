import { createClient } from "@/lib/supabase/server";
import { todayMerida } from "@/lib/tz";
import { shiftMonth, monthBounds } from "@/lib/calendar-grid";
import CalendarioClient, { type Deadline, type VacationRange, type NextActivity } from "./client";

/* ═══════════════════════════════════════════════════════════════
   Calendario personal (empleado/coordinador/departamento/rh) — mismas
   tres vistas Día/Semana/Mes que admin/calendario, pero sobre los
   datos de UNA sola persona: sus fechas límite, sus vacaciones
   aprobadas, los días inhábiles y los eventos ya agendados en
   "Eventos CERT" (Google Calendar). Antes esta pantalla solo tenía
   vista de Mes fija — se lleva a la paridad de vistas que ya tiene
   admin/calendario, porque el cambio debe aplicar parejo para todo
   el equipo, no solo para el admin.
   ═══════════════════════════════════════════════════════════════ */

export default async function CalendarioEmpleado({ searchParams }: { searchParams: Promise<{ m?: string; d?: string }> }) {
  const { m, d } = await searchParams;
  const today = todayMerida();
  const ym = /^\d{4}-\d{2}$/.test(m ?? "") ? m! : today.slice(0, 7);
  const initialFocusDate = /^\d{4}-\d{2}-\d{2}$/.test(d ?? "") && (d as string).slice(0, 7) === ym ? d! : undefined;
  const { year, month, daysInMonth, first, last } = monthBounds(ym);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("users").select("id, display_name").eq("auth_id", user!.id).single();

  const [{ data: vacs }, { data: hols }, { data: assignments }, { data: allAssignments }, { data: activitySetting }] = await Promise.all([
    supabase.from("vacations").select("start_date, end_date")
      .eq("user_id", profile!.id).eq("status", "Aprobada").is("archived_at", null)
      .lte("start_date", last).gte("end_date", first),
    supabase.from("holidays").select("date, name").gte("date", first).lte("date", last),
    supabase.from("project_assignments")
      .select("projects(id, deadline, status, requests(title, type))")
      .eq("user_id", profile!.id),
    // Todas las asignaciones (sin acotar al mes en pantalla) — para el aviso
    // de "próxima actividad", que no debe depender de qué mes se esté viendo.
    supabase.from("project_assignments")
      .select("projects(deadline, status, requests(title))")
      .eq("user_id", profile!.id),
    supabase.from("app_settings").select("value").eq("key", "gcal_activity_calendar_id").maybeSingle(),
  ]);

  // Eventos ya agendados en "Eventos CERT" (Google Calendar) — misma fuente
  // que ve el admin en su Calendario, para que el colaborador vea la misma
  // agenda del departamento, no solo sus propias fechas límite.
  type GEvent = { id: string; title: string; start: string; end: string; allDay: boolean };
  let gcalEvents: GEvent[] = [];
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
      if (error) gcalError = "No se pudo conectar con el servidor para leer Google Calendar. Intenta recargar la página.";
      else if (data?.ok) gcalEvents = data.events ?? [];
      else gcalError = data?.error ?? "Google Calendar no devolvió eventos.";
    } catch {
      gcalError = "Ocurrió un error inesperado leyendo Google Calendar. Intenta recargar la página.";
    }
  }

  const nextActivity: NextActivity = (allAssignments ?? [])
    .map((a) => a.projects as unknown as { deadline: string | null; status: string; requests: { title: string } | null } | null)
    .filter((p): p is { deadline: string; status: string; requests: { title: string } | null } =>
      !!p?.deadline && p.deadline >= today && !["completada", "cancelada", "rechazada"].includes(p.status))
    .sort((a, b) => a.deadline.localeCompare(b.deadline))[0] ?? null;

  const deadlines = (assignments ?? [])
    .map((a) => a.projects as unknown as Deadline | null)
    .filter((p): p is Deadline => !!p);

  return (
    <CalendarioClient
      ym={ym} year={year} month={month} daysInMonth={daysInMonth} today={today}
      prevHref={`/comunicacion/calendario?m=${shiftMonth(ym, -1)}`}
      nextHref={`/comunicacion/calendario?m=${shiftMonth(ym, 1)}`}
      vacations={(vacs ?? []) as VacationRange[]}
      holidays={(hols ?? []) as { date: string; name: string }[]}
      deadlines={deadlines}
      gcalEvents={gcalEvents}
      gcalError={gcalError}
      nextActivity={nextActivity}
      initialFocusDate={initialFocusDate}
    />
  );
}
