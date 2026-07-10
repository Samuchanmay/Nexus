import { createClient } from "@/lib/supabase/server";
import { typeLabels } from "@/lib/types";
import type { ActivityType } from "@/lib/types";
import ProyectosClient, { type ProjectRow, type DepRow } from "./client";

export default async function Proyectos() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: projects }, { data: deps }, { data: types }, { data: team }, meRes] = await Promise.all([
    supabase.from("projects")
      .select("id, status, priority, deadline, created_at, requests(title, type), project_assignments(is_lead, users(display_name, nexus_color))")
      .order("created_at", { ascending: false }),
    supabase.from("project_dependencies")
      .select("id, project_id, depends_on_project_id, projects!project_dependencies_depends_on_project_id_fkey(id, status, requests(title))"),
    supabase.from("activity_types").select("*").eq("activo", true).order("orden"),
    supabase.from("users").select("id, display_name, nexus_color")
      .eq("active", true).in("role", ["admin", "empleado"]),
    user ? supabase.from("users").select("id").eq("auth_id", user.id).single() : Promise.resolve({ data: null }),
  ]);
  const activityTypes = (types ?? []) as ActivityType[];
  return (
    <ProyectosClient
      projects={(projects ?? []) as unknown as ProjectRow[]}
      dependencies={(deps ?? []) as unknown as DepRow[]}
      typeLabel={typeLabels(activityTypes)}
      types={activityTypes.map((t) => ({ key: t.key, label: t.label }))}
      team={(team ?? []) as { id: string; display_name: string; nexus_color: string | null }[]}
      adminId={meRes?.data?.id ?? ""}
    />
  );
}
