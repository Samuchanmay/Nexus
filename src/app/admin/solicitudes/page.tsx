import { createClient } from "@/lib/supabase/server";
import type { CommRequest } from "@/lib/types";
import SolicitudesClient from "./client";

export default async function Solicitudes() {
  const supabase = await createClient();
  const [{ data: reqs }, { data: team }] = await Promise.all([
    supabase.from("requests")
      .select("*, users:requester_id(full_name, title)")
      .order("created_at", { ascending: false }),
    supabase.from("users").select("id, display_name, nexus_color, specialties")
      .eq("active", true).in("role", ["admin", "empleado"]),
  ]);
  return (
    <SolicitudesClient
      requests={(reqs ?? []) as unknown as CommRequest[]}
      team={(team ?? []) as { id: string; display_name: string; nexus_color: string | null; specialties: string[] }[]}
    />
  );
}
