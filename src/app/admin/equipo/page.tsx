import { createClient } from "@/lib/supabase/server";
import { summarizeDay, stateAfter, scheduleFor } from "@/lib/hours";
import type { JornadaState } from "@/lib/hours";
import { typeLabels } from "@/lib/types";
import type { ActivityType } from "@/lib/types";
import type { AttendanceRow, Schedule, Priority, RequestType, Incident } from "@/lib/types";
import { todayMerida } from "@/lib/tz";
import EquipoClient, { type TeamMember } from "./client";

/** Carga del equipo — server junta todo; el panel contextual (L4) vive en client.tsx */
export default async function Equipo() {
  const supabase = await createClient();
  const today = todayMerida();
  const [{ data: team }, { data: assignments }, { data: att }, { data: scheds }, { data: vacs }, { data: incs }, { data: jornadaStates }, { data: activityTypes }, { data: hols }, { data: restDays }] =
    await Promise.all([
      supabase.from("users").select("id, display_name, full_name, nexus_color, specialties, area, avatar_url, birth_date")
        .eq("active", true).in("role", ["admin", "empleado"]),
      supabase.from("project_assignments")
        .select("user_id, is_lead, projects(status, priority, requests(title, type))"),
      supabase.from("attendance").select("*").eq("date", today).order("time"),
      supabase.from("schedules").select("*"),
      supabase.from("vacations").select("user_id, start_date, end_date, status")
        .in("status", ["Aprobada", "Pendiente"]).is("archived_at", null).gte("end_date", today).order("start_date").limit(40),
      // Autorizado + Pendiente: lo Pendiente alimenta el panel contextual; lo
      // Autorizado explica el estado del día (permiso/incapacidad hoy) en el resolver.
      supabase.from("incidents").select("user_id, kind, start_date, end_date, status")
        .in("status", ["Autorizado", "Pendiente"]).order("start_date"),
      supabase.from("jornada_states").select("*").eq("activo", true),
      supabase.from("activity_types").select("*"),
      supabase.from("holidays").select("date"),
      supabase.from("rest_days").select("user_id, note, start_date, end_date"),
    ]);
  const states = (jornadaStates ?? []) as JornadaState[];
  const stateColor = new Map(states.map((s) => [s.nombre, s.color]));
  const typeLabel = typeLabels((activityTypes ?? []) as ActivityType[]);

  const rows = (att ?? []) as AttendanceRow[];
  const members: TeamMember[] = (team ?? []).map((u) => {
    const mine = (assignments ?? []).filter((a) => {
      const p = a.projects as unknown as { status: string } | null;
      return a.user_id === u.id && p && !["completada", "cancelada"].includes(p.status);
    });
    const sched = scheduleFor((scheds ?? []) as Schedule[], u.id, today);
    const day = summarizeDay(today, rows.filter((r) => r.user_id === u.id), sched ?? { target_min: 480, tolerance_min: 15, end_time: "18:00:00" }, states);
    const myRows = rows.filter((r) => r.user_id === u.id);
    const last = myRows.at(-1);
    const liveState = day.isOpen && last ? stateAfter(last) : null;
    return {
      id: u.id,
      display_name: u.display_name,
      full_name: u.full_name,
      area: u.area,
      nexus_color: u.nexus_color,
      avatar_url: u.avatar_url,
      birth_date: u.birth_date,
      specialties: (u.specialties as string[]) ?? [],
      tasks: mine.map((a) => {
        const p = a.projects as unknown as { status: string; priority: Priority; requests: { title: string; type: RequestType } | null };
        return {
          title: p.requests?.title ?? "Proyecto",
          type: p.requests?.type ?? null,
          typeLabel: p.requests?.type ? (typeLabel[p.requests.type] ?? p.requests.type) : null,
          priority: p.priority,
          status: p.status,
          is_lead: a.is_lead,
        };
      }),
      today: {
        firstIn: day.firstIn, totalMin: day.totalMin, targetMin: day.targetMin,
        isOpen: day.isOpen, movesCount: day.movements.length,
        stateName: liveState, stateColor: liveState ? (stateColor.get(liveState) ?? null) : null,
        noRegistroSalida: day.noRegistroSalida,
      },
      upcomingVacs: (vacs ?? []).filter((v) => v.user_id === u.id)
        .map((v) => ({ start_date: v.start_date, end_date: v.end_date, status: v.status })),
      pendingIncs: (incs ?? []).filter((i) => i.user_id === u.id)
        .map((i) => ({ kind: i.kind as Incident["kind"], start_date: i.start_date, end_date: i.end_date, status: i.status as Incident["status"] })),
      todayIncident: (incs ?? []).find((i) => i.user_id === u.id && i.status === "Autorizado" && i.start_date <= today && i.end_date >= today)
        ?.kind as Incident["kind"] ?? null,
      todayRestDay: (restDays ?? []).find((r) => r.user_id === u.id && r.start_date <= today && r.end_date >= today)?.note as string | null ?? null,
      isHolidayToday: (hols ?? []).some((h) => h.date === today),
    };
  });

  return <EquipoClient members={members} today={today} />;
}
