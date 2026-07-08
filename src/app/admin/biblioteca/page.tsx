import { createClient } from "@/lib/supabase/server";
import BibliotecaClient, { type Item } from "./client";

/* ═══════════════════════════════════════════════════════════════
   Biblioteca institucional — Plano Maestro §16.
   Índice consultable de actividades ya terminadas (completada),
   con sus evidencias, comentarios y colaboradores. Es un archivo:
   nadie edita aquí, el sistema lo llena al terminar una actividad.
   ═══════════════════════════════════════════════════════════════ */

export default async function Biblioteca() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select(`
      id, deadline, priority,
      requests(title, type, subtype, requester_name, requester_area, event_date),
      project_assignments(is_lead, users(display_name, nexus_color)),
      evidences(id, drive_url, publish_url, created_at),
      comments(id)
    `)
    .eq("status", "completada")
    .order("deadline", { ascending: false });

  return <BibliotecaClient items={(data ?? []) as unknown as Item[]} />;
}
