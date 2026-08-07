import { createClient } from "@/lib/supabase/server";
import { typeLabels } from "@/lib/types";
import type { ActivityType } from "@/lib/types";
import ProyectosClient, { type ProjectRow, type DepRow, type PendingRequestRow } from "./client";

export default async function Proyectos() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: projects }, { data: deps }, { data: types }, { data: team }, meRes, { data: pendingRequests }, { data: events }] = await Promise.all([
    supabase.from("projects")
      .select("id, status, priority, deadline, completed_at, created_at, requests(title, type), project_assignments(is_lead, users(id, display_name, full_name, nexus_color, avatar_url, birth_date), project_checklist(done)), institutional_event_id, institutional_events(id, title, start_date, end_date, start_time, end_time, location_name)")
      .order("created_at", { ascending: false }),
    supabase.from("project_dependencies")
      .select("id, project_id, depends_on_project_id, projects!project_dependencies_depends_on_project_id_fkey(id, status, requests(title))"),
    supabase.from("activity_types").select("*").eq("activo", true).order("orden"),
    supabase.from("users").select("id, display_name, full_name, nexus_color, avatar_url, birth_date")
      .eq("active", true).in("role", ["admin", "empleado"]),
    user ? supabase.from("users").select("id").eq("auth_id", user.id).single() : Promise.resolve({ data: null }),
    // Solicitudes sin triar todavía — Fase 3: la vista Pipeline las muestra
    // como primera columna (Solicitada) para que el flujo completo se vea
    // en un solo lugar, sin duplicar la lógica de aprobar/rechazar que sigue
    // viviendo en Solicitudes (las tarjetas de esta columna solo enlazan ahí).
    supabase.from("requests").select("id, title, type, requester_name, priority, created_at")
      .eq("status", "solicitada").order("created_at", { ascending: false }),
    // Lista liviana para el picker "vincular a evento" — no hace falta el
    // evento completo (ubicación, GPS, Google sync…), solo lo necesario
    // para identificarlo en un <Select>. Se ordena por fecha descendente
    // para que los eventos recientes/próximos queden arriba.
    supabase.from("institutional_events").select("id, title, start_date")
      .order("start_date", { ascending: false }).limit(100),
  ]);
  const activityTypes = (types ?? []) as ActivityType[];

  return (
    <ProyectosClient
      projects={(projects ?? []) as unknown as ProjectRow[]}
      dependencies={(deps ?? []) as unknown as DepRow[]}
      pendingRequests={(pendingRequests ?? []) as unknown as PendingRequestRow[]}
      typeLabel={typeLabels(activityTypes)}
      types={activityTypes.map((t) => ({ key: t.key, label: t.label }))}
      team={(team ?? []) as { id: string; display_name: string; full_name: string; nexus_color: string | null; avatar_url: string | null; birth_date: string | null }[]}
      adminId={meRes?.data?.id ?? ""}
      eventOptions={(events ?? []) as { id: string; title: string; start_date: string }[]}
    />
  );
}
