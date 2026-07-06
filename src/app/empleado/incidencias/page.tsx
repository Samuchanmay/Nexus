import { createClient } from "@/lib/supabase/server";
import type { Incident } from "@/lib/types";
import IncidenciasClient from "./client";

export default async function Incidencias() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("users").select("id").eq("auth_id", user!.id).single();
  const { data: incs } = await supabase
    .from("incidents").select("*").eq("user_id", profile!.id).order("created_at", { ascending: false });
  return <IncidenciasClient userId={profile!.id} incidents={(incs ?? []) as Incident[]} />;
}
