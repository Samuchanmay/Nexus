import { createClient } from "@/lib/supabase/server";
import { summarizeDay } from "@/lib/hours";
import type { AttendanceRow, Schedule } from "@/lib/types";
import MiDiaClient from "./tasks";
import { todayMerida, addDays, isoWeekday } from "@/lib/tz";

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

  const [{ data: att }, { data: weekAtt }, { data: sched }, { data: assignments }] = await Promise.all([
    supabase.from("attendance").select("*").eq("user_id", profile.id).eq("date", today).order("time"),
    supabase.from("attendance").select("date").eq("user_id", profile.id).gte("date", monday).lte("date", sunday),
    supabase.from("schedules").select("*").eq("user_id", profile.id).is("valid_until", null).limit(1).single(),
    supabase.from("project_assignments")
      .select("id, is_lead, projects(id, status, priority, deadline, requests(title, type, requester_name))")
      .eq("user_id", profile.id),
  ]);

  const schedule = (sched ?? { target_min: 480, tolerance_min: 15 }) as Schedule;
  const day = summarizeDay(today, (att ?? []) as AttendanceRow[], schedule);
  const weekDates = [...new Set((weekAtt ?? []).map((r) => r.date as string))];

  const tasks = (assignments ?? [])
    .map((a) => {
      const p = a.projects as unknown as {
        id: string; status: string; priority: string; deadline: string | null;
        requests: { title: string; type: string; requester_name: string | null } | null;
      } | null;
      if (!p) return null;
      return {
        assignmentId: a.id as string,
        isLead: a.is_lead as boolean,
        projectId: p.id,
        title: p.requests?.title ?? "Proyecto",
        type: p.requests?.type ?? "diseno",
        requester: p.requests?.requester_name ?? null,
        status: p.status,
        priority: p.priority,
        deadline: p.deadline,
      };
    })
    .filter((t): t is NonNullable<typeof t> => t !== null && !["completada", "cancelada"].includes(t.status));

  return (
    <MiDiaClient
      profile={{ id: profile.id, displayName: profile.display_name }}
      day={{ totalMin: day.totalMin, targetMin: day.targetMin, isOpen: day.isOpen, hasEntry: !!day.firstIn }}
      week={{ monday, today, datesWithActivity: weekDates }}
      assignments={tasks}
    />
  );
}
