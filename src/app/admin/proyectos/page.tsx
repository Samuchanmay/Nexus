import { createClient } from "@/lib/supabase/server";
import { typeLabels } from "@/lib/types";
import type { ActivityType } from "@/lib/types";
import ProyectosClient, { type ProjectRow, type DepRow, type PendingRequestRow } from "./client";

export default async function Proyectos() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: projects }, { data: deps }, { data: types }, { data: team }, { data: logs }, meRes, { data: pendingRequests }] = await Promise.all([
    supabase.from("projects")
      .select("id, status, priority, deadline, completed_at, created_at, requests(title, type), project_assignments(is_lead, users(id, display_name, full_name, nexus_color, avatar_url, birth_date), project_checklist(done))")
      .order("created_at", { ascending: false }),
    supabase.from("project_dependencies")
      .select("id, project_id, depends_on_project_id, projects!project_dependencies_depends_on_project_id_fkey(id, status, requests(title))"),
    supabase.from("activity_types").select("*").eq("activo", true).order("orden"),
    supabase.from("users").select("id, display_name, full_name, nexus_color, avatar_url, birth_date")
      .eq("active", true).in("role", ["admin", "empleado"]),
    supabase.from("task_time_logs").select("minutes, project_assignments(user_id)"),
    user ? supabase.from("users").select("id").eq("auth_id", user.id).single() : Promise.resolve({ data: null }),
    // Solicitudes sin triar todavía — Fase 3: la vista Pipeline las muestra
    // como primera columna (Solicitada) para que el flujo completo se vea
    // en un solo lugar, sin duplicar la lógica de aprobar/rechazar que sigue
    // viviendo en Solicitudes (las tarjetas de esta columna solo enlazan ahí).
    supabase.from("requests").select("id, title, type, requester_name, priority, created_at")
      .eq("status", "solicitada").order("created_at", { ascending: false }),
  ]);
  const activityTypes = (types ?? []) as ActivityType[];

  // Total de minutos registrados por persona (todo el historial) — usado en
  // el reporte de Actividades por empleado.
  const hoursByUserMin: Record<string, number> = {};
  for (const l of (logs ?? [])) {
    const uid = (l.project_assignments as unknown as { user_id: string } | null)?.user_id;
    if (!uid) continue;
    hoursByUserMin[uid] = (hoursByUserMin[uid] ?? 0) + (l.minutes ?? 0);
  }

  return (
    <ProyectosClient
      projects={(projects ?? []) as unknown as ProjectRow[]}
      dependencies={(deps ?? []) as unknown as DepRow[]}
      pendingRequests={(pendingRequests ?? []) as unknown as PendingRequestRow[]}
      typeLabel={typeLabels(activityTypes)}
      types={activityTypes.map((t) => ({ key: t.key, label: t.label }))}
      team={(team ?? []) as { id: string; display_name: string; full_name: string; nexus_color: string | null; avatar_url: string | null; birth_date: string | null }[]}
      hoursByUserMin={hoursByUserMin}
      adminId={meRes?.data?.id ?? ""}
    />
  );
}
