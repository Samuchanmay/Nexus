import { createClient } from "@/lib/supabase/server";
import type { CommRequest, UserProfile, ActivityType } from "@/lib/types";
import CoordinadorClient from "./client";

export default async function Coordinador() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("users").select("*, departments(id, nombre, tipo)").eq("auth_id", user!.id).single();
  const [{ data: reqs }, { data: actTypes }] = await Promise.all([
    supabase.from("requests").select("*, projects(status)").eq("requester_id", profile!.id)
      .order("created_at", { ascending: false }),
    supabase.from("activity_types").select("*").eq("activo", true).order("orden"),
  ]);
  return (
    <CoordinadorClient
      profile={profile as UserProfile}
      requests={(reqs ?? []) as unknown as CommRequest[]}
      activityTypes={(actTypes ?? []) as ActivityType[]}
    />
  );
}
