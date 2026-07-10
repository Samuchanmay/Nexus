import { createClient } from "@/lib/supabase/server";
import { todayMerida } from "@/lib/tz";
import { shiftMonth, monthBounds } from "@/lib/calendar-grid";
import CalendarioClient, { type TeamMember, type ProjectDeadline, type VacationRange } from "./client";

/* ═══════════════════════════════════════════════════════════════
   L5 · Calendario del equipo — tres vistas (Asistencia / Actividades
   / Vacaciones) sobre el mismo mes, con días inhábiles como contexto
   compartido. La vista de Asistencia es el heatmap heredado de
   cert_nexus; Actividades y Vacaciones son nuevas.
   ═══════════════════════════════════════════════════════════════ */

export default async function Calendario({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  const today = todayMerida();
  const ym = /^\d{4}-\d{2}$/.test(m ?? "") ? m! : today.slice(0, 7);
  const { year, month, daysInMonth, first, last } = monthBounds(ym);

  const supabase = await createClient();
  const [{ data: team }, { data: att }, { data: vacs }, { data: hols }, { data: projects }] = await Promise.all([
    supabase.from("users").select("id, display_name, nexus_color").eq("active", true).in("role", ["admin", "empleado"]).order("display_name"),
    supabase.from("attendance").select("user_id, date").gte("date", first).lte("date", last),
    supabase.from("vacations").select("user_id, start_date, end_date").eq("status", "Aprobada").lte("start_date", last).gte("end_date", first),
    supabase.from("holidays").select("date, name").gte("date", first).lte("date", last),
    supabase.from("projects")
      .select("id, deadline, status, requests(title, type), project_assignments(is_lead, users(display_name, nexus_color))")
      .not("deadline", "is", null).gte("deadline", first).lte("deadline", last).order("deadline"),
  ]);

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
    />
  );
}
