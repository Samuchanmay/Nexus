import { createClient } from "@/lib/supabase/server";
import ProyectosClient, { type ProjectRow, type DepRow } from "./client";

export default async function Proyectos() {
  const supabase = await createClient();
  const [{ data: projects }, { data: deps }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, status, priority, deadline, created_at, requests(title, type), project_assignments(is_lead, users(display_name, nexus_color))")
      .order("created_at", { ascending: false }),
    supabase
      .from("project_dependencies")
      .select("id, project_id, depends_on_project_id, projects!project_dependencies_depends_on_project_id_fkey(id, status, requests(title))"),
  ]);

  return <ProyectosClient projects={(projects ?? []) as unknown as ProjectRow[]} dependencies={(deps ?? []) as unknown as DepRow[]} />;
}
