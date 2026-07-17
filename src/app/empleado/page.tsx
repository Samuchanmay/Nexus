import { createClient } from "@/lib/supabase/server";
import { summarizeDay, currentState } from "@/lib/hours";
import type { JornadaState } from "@/lib/hours";
import type { AttendanceRow, Schedule, ActivityType } from "@/lib/types";
import MiDiaClient from "./tasks";
import { todayMerida, addDays, isoWeekday, nowMeridaMinutes } from "@/lib/tz";
import { contextualMessages } from "@/lib/assistant";
import type { AssistantTask } from "@/lib/assistant";

/** Mi Día — server: junta los datos; el diseño v6 vive en el client (tasks.tsx). */
export default async function MiDia() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("users").select("*").eq("auth_id", user!.id).single();

  const today = todayMerida();
  // Lunes de esta semana (para la tira semanal v6)
  const dow = isoWeekday(today); // 0=Dom
  const monday = addDays(today, dow === 0 ? -6 : 1 - dow);
  const sunday = addDays(monday, 6);

  const [{ data: att }, { data: weekAtt }, { data: sched }, { data: assignments }, { data: jornadaStates }, { data: actTypes }] = await Promise.all([
    supabase.from("attendance").select("*").eq("user_id", profile.id).eq("date", today).order("time"),
    supabase.from("attendance").select("date").eq("user_id", profile.id).gte("date", monday).lte("date", sunday),
    supabase.from("schedules").select("*").eq("user_id", profile.id).is("valid_until", null).limit(1).single(),
    supabase.from("project_assignments")
      .select("id, is_lead, projects(id, status, priority, deadline, requests(title, type, requester_name, event_date, event_time))")
      .eq("user_id", profile.id),
    supabase.from("jornada_states").select("*").eq("activo", true),
    supabase.from("activity_types").select("*").eq("activo", true).order("orden"),
  ]);
  const states = (jornadaStates ?? []) as JornadaState[];
  const activityTypes = (actTypes ?? []) as ActivityType[];

  // Dependencias entre actividades (Plano Maestro §04): qué bloquea a cada proyecto asignado.
  const projectIds = [...new Set((assignments ?? [])
    .map((a) => (a.projects as unknown as { id: string } | null)?.id)
    .filter((id): id is string => !!id))];
  const [{ data: deps }, { data: evidenceRows }] = await Promise.all([
    projectIds.length
      ? supabase.from("project_dependencies")
          .select("project_id, projects!project_dependencies_depends_on_project_id_fkey(status, requests(title))")
          .in("project_id", projectIds)
      : Promise.resolve({ data: [] as { project_id: string; projects: { status: string; requests: { title: string } | null } | null }[] }),
    projectIds.length
      ? supabase.from("evidences").select("project_id").in("project_id", projectIds)
      : Promise.resolve({ data: [] as { project_id: string }[] }),
  ]);
  const blockedByOf = new Map<string, string[]>();
  for (const d of (deps ?? []) as unknown as { project_id: string; projects: { status: string; requests: { title: string } | null } | null }[]) {
    if (!d.projects || d.projects.status === "completada") continue;
    const list = blockedByOf.get(d.project_id) ?? [];
    list.push(d.projects.requests?.title ?? "otra actividad");
    blockedByOf.set(d.project_id, list);
  }
  // Asistente Contextual (Plano Maestro §11): qué proyectos ya tienen evidencia subida.
  const projectsWithEvidence = new Set((evidenceRows ?? []).map((e) => e.project_id as string));

  const schedule = (sched ?? { target_min: 480, tolerance_min: 15 }) as Schedule;
  const day = summarizeDay(today, (att ?? []) as AttendanceRow[], schedule, states);
  const live = currentState((att ?? []) as AttendanceRow[], today, states);
  const weekDates = [...new Set((weekAtt ?? []).map((r) => r.date as string))];

  const tasks = (assignments ?? [])
    .map((a) => {
      const p = a.projects as unknown as {
        id: string; status: string; priority: string; deadline: string | null;
        requests: { title: string; type: string; requester_name: string | null; event_date: string | null; event_time: string | null } | null;
      } | null;
      if (!p) return null;
      return {
        assignmentId: a.id as string,
        isLead: a.is_lead as boolean,
        projectId: p.id,
        title: p.requests?.title ?? "Proyecto",
        type: p.requests?.type ?? (activityTypes[0]?.key ?? ""),
        requester: p.requests?.requester_name ?? null,
        status: p.status,
        priority: p.priority,
        deadline: p.deadline,
        eventDate: p.requests?.event_date ?? null,
        eventTime: p.requests?.event_time ?? null,
        hasEvidence: projectsWithEvidence.has(p.id),
        blockedBy: blockedByOf.get(p.id) ?? [],
      };
    })
    .filter((t): t is NonNullable<typeof t> => t !== null && !["completada", "cancelada"].includes(t.status));

  // El asistente observa TODAS las tareas asignadas (incluidas completada/cancelada
  // recién cerradas no aplica — ya se filtraron arriba), calculado en cada carga,
  // sin persistencia: siempre datos frescos.
  const assistantMessages = contextualMessages({
    today, nowMin: nowMeridaMinutes(),
    tasks: tasks.map((t): AssistantTask => ({
      projectId: t.projectId, title: t.title, status: t.status, deadline: t.deadline,
      eventDate: t.eventDate, eventTime: t.eventTime, isLead: t.isLead, hasEvidence: t.hasEvidence,
    })),
    birthDate: profile.birth_date ?? null,
    working: day.isOpen,
  });

  return (
    <MiDiaClient
      profile={{ id: profile.id, displayName: profile.display_name }}
      day={{
        totalMin: day.totalMin, targetMin: day.targetMin, isOpen: day.isOpen, hasEntry: !!day.firstIn,
        stateName: live?.nombre ?? null, stateColor: live?.color ?? null,
      }}
      week={{ monday, today, datesWithActivity: weekDates }}
      assignments={tasks}
      activityTypes={activityTypes}
      assistantMessages={assistantMessages}
    />
  );
}
