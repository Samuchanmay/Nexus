import { createClient } from "@/lib/supabase/server";
import type { CommRequest, ActivityType } from "@/lib/types";
import { typeLabels, typeMinHours } from "@/lib/types";
import SolicitudesClient from "./client";

export default async function Solicitudes() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: reqs }, { data: team }, { data: types }, meRes] = await Promise.all([
    supabase.from("requests")
      .select("*, users:requester_id(full_name, title)")
      .order("created_at", { ascending: false }),
    supabase.from("users").select("id, display_name, nexus_color, specialties")
      .eq("active", true).in("role", ["admin", "empleado"]),
    supabase.from("activity_types").select("*"),
    user ? supabase.from("users").select("id").eq("auth_id", user.id).single() : Promise.resolve({ data: null }),
  ]);
  const activityTypes = (types ?? []) as ActivityType[];
  return (
    <SolicitudesClient
      requests={(reqs ?? []) as unknown as CommRequest[]}
      team={(team ?? []) as { id: string; display_name: string; nexus_color: string | null; specialties: string[] }[]}
      typeLabel={typeLabels(activityTypes)}
      minHours={typeMinHours(activityTypes)}
      adminId={meRes?.data?.id ?? ""}
    />
  );
}
